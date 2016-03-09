var express     = require('express'),
    app         = express(),
    port        = process.env.PORT || 3000,
	fs          = require('fs'),
    path        = require('path'),
    fH          = require('./fileHandler'),
    streamifier = require('streamifier'),
    stylus      = require('stylus'),
	nib         = require('nib')
	multer      = require("multer"),
    docxbuilder = require('./docxbuilder'),
    unoconv     = require('unoconv'),
	loPort      = require('./loPort'),
    server      = require('http').createServer(app),
    io          = require('socket.io').listen(server),
	mkdir       = require('mkdirp');
//	ss          = require('socket.io-stream');
    
var allowCrossDomain = function(req, res, next) {
    if ( req.method == 'OPTIONS' ) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Disposition, Content-Type, Authorization, Content-Length, X-Requested-With');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
	  next();
    }
    else {
      next();
    }
};

var mimetypesArr = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template']
  , NrMimetypes = mimetypesArr.length
  , mimetypes = mimetypesArr.join();
  
function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .use(nib())
}

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
//app.use(express.morgan('dev'))
app.use(stylus.middleware(
  { src: __dirname + '/public'
  , compile: compile
  }
));

app.use(express.static(__dirname + '/public'));

var router = express.Router();

router.use(allowCrossDomain);

if (process.platform != 'win32')  // Ik krijg unoconv op Windows niet aan de praat
   {
	  // Start een aantal malen een listener voor libreOffice/unoconv voor parallelliteit
      unoconv.listen({port:2002});
//      unoconv.listen({port:2003});
   }

router.get('/', function(req, res) {
  var lijst = [];

  res.render('index',
	{ title : 'nDocxus Templating Engine'
	, mimetypes : mimetypes
	, values : lijst
	}
	)
});

var customerSockets = {}

var createDirList = function (customerID, callback) {
       var dirlist = [];
       p = 'b/' + customerID;
       fs.readdir(p, function (err, files) {
          if (err) {
            console.log(err.message);
			callback({message:'Please load a docx template...'});
          }
          else
          {
            files.map(function (file) {
               return path.join(p, file);
             }).filter(function (file) {
                return fs.statSync(file).isFile();
               }).forEach(function (file) {
               dirlist.push(path.basename(file));
             //    console.log("%s (%s)", file, path.basename(file));
             });
             return callback(null,dirlist);
          }
        });
}

var pushClientStatus = function (customerID) {
   createDirList(customerID, function(err,dirList) {
	 if (err) {
       customerSockets[customerID].emit('message', err);
	 }
	 else {
       var JSONdirlist = JSON.parse('{"message": "Ready...","dirlist":' + JSON.stringify(dirList) + '}');
       customerSockets[customerID].emit('dirlist', JSONdirlist);
	 }
   });
}

io.sockets.on('connection', function (socket) {
	//console.log('connection: ' + socket.id);
    socket.emit('handshake', { message: 'Ready...'}, function(customerID) {
        console.log('customerID uit handshake: ' + customerID);
        socket.customerID = customerID;
        customerSockets[customerID] = socket;
		//Directory-list doorgeven
		pushClientStatus(customerID);
    });
    
    socket.on('disconnect', function() {
        console.log(socket.customerID + ' has disconnected');
        delete customerSockets[socket.customerID];
    });
});

var convertPDF = function(archive, docID, callback) {
    var tmpFile, docxFile;
    //  console.log('Afhandeling PDF');
    if (docID)
    { 
	  tmpFile = './tmp/' + docID + '.docx';
	}
	else
	{
	  tmpFile = './tmp/tmp.docx';
	}
	// Pipe archive-stream naar temporary (docx) file
	docxFile = fs.createWriteStream(tmpFile);
	var filePipe = archive.pipe(docxFile);
	filePipe.on('finish', function() {
	  // Converteer docx naar PDF
	  var unoconvOptions = JSON.parse('{"port":"2002"}');
      try
      {
 	     unoconv.convert(tmpFile, 'pdf', unoconvOptions, function (err, result) {
		    callback(err, result);
            fs.unlink(tmpFile);
 	     });
      }
      catch (e)
      {
          callback(e, null);
      }
	});
}

router.post('/multi', function (req, res) {
  //console.log('multi request...');
    function endInError(err) {
        res.status(500);
		console.log('Fout: ' + err.message);
        res.end(err.message);
	}

	var body = "";

	req.on('data', function(data) {
       body += data;
	});
	
	req.on('end', function() {
      
	  var command;

	  try
 	  { //console.log('--' + body + '--');
	  	  command = JSON.parse(body.trim());
		  
          res.setHeader('Access-Control-Allow-Origin', '*');
  	      res.setHeader('Content-Type', 'text/plain');
		  res.status(200);
          res.end();
		  
          var mergeList
            , filePath
            , filePipe;
		  
		  var createFileStream = function(callback) {
 	        var fileStream = fs.createWriteStream('./b/' + command.customerID + '/' + mergeList.Factuurnummer + '.' + mergeList.outputformat.toLowerCase());
			return callback(fileStream);
		  }
		  
		  for (i=0; i < command.mergeList.length; i++)
		  {
            customerSockets[command.customerID].emit('message', {message:"Processing " + (i+1) + ' of ' + command.mergeList.length});
			mergeList = command.mergeList[i];
            filePath = './b/' + command.customerID + '/Templates/templateFile';

              //    console.log(JSON.stringify(command.mergeList));
	          docxbuilder.build(filePath, mergeList, function(err,archive) {
                if (err) {
                  endInError(err);
                }
                else
                {
                  if ( (!command.mergeList[0].outputformat) || command.mergeList[0].outputformat == 'DOCX')
				  {
					createFileStream(function(fileStream) {
 				      filePipe = archive.pipe(fileStream);
                      filePipe.on('finish', function() {
	                    pushClientStatus(command.customerID);
                      });
					});
				  }
				  else if (command.mergeList[0].outputformat == 'PDF')
				  {  //Converteer archive-stream naar een PDF
					convertPDF(archive, command.customerID, function(err, result) {
                        if (err)
                        {
                           console.log('PDF Conversion error, Customer: ' + command.customerID + '; ' + err);
                           customerSockets[command.customerID].emit('message', {message:"Conversion error"});
                        }
                        else
                        {
					      createFileStream(function(fileStream) {
  	                        // Pipe result-buffer met PDF naar file
	                        filePipe = streamifier.createReadStream(result).pipe(fileStream);  
                            filePipe.on('finish', function() {
	                        pushClientStatus(command.customerID);
                            });
						  });
                        }
					});
				  } 
                }
              });
		  }
	 }
	 catch(err) {
         endInError(err);
	  }
   });
});
   
router.post('/docx', function(req, res) {

  //console.log('docx request...');
    function endInError(err) {
		console.log('Fout: ' + err.message);
  	//    res.setHeader('Content-Type', 'text/plain');
        res.status(500);
        res.end(err.message);
	}

	var body = "";

	req.on('data', function(data) {
       body += data;
	});
	
	req.on('end', function() {
      var command
        , filePath;

      var setHeaders = function (callback) {
         res.setHeader('Access-Control-Allow-Origin', '*');
      	 res.setHeader('Content-Type', 'application/octet-stream');
	     res.setHeader('Transfer-Encoding', 'chunked');
	     //res.setHeader('Content-Length', docout.length);
         res.setHeader('Content-Disposition', 'attachment; output.docx');
         return callback();
      };
      
	  try
 	  { //console.log('--' + body + '--');
	  	command = JSON.parse(body.trim());

        filePath = './b/' + command.customerID + '/Templates/templateFile';
		
        docxbuilder.build(filePath, command.mergeList[0], function(err,archive) {
			//   console.log('Probeer te zenden...');
            if (err) {
              endInError(err);
            }
            else
            {
              setHeaders(function() {
                customerSockets[command.customerID].emit('message', {message:"Processing..."});
                if ( (!command.mergeList[0].outputformat) || command.mergeList[0].outputformat == 'DOCX')
		        {
				  // Pipe archive-stream naar http res
 		          var responsePipe = archive.pipe(res);
			      responsePipe.on('finish', function() {
                    customerSockets[command.customerID].emit('message', {message:"Ready..."});
                    res.end();
                  });
			    }
			    else if (command.mergeList[0].outputformat == 'PDF')
			    {  //Converteer archive-stream naar een PDF
			      convertPDF(archive, command.customerID, function(result) {
	                // Pipe result-buffer met PDF naar http res
	                var responsePipe = streamifier.createReadStream(result).pipe(res);  
 	                responsePipe.on('finish', function() {
                      customerSockets[command.customerID].emit('message', {message:"Ready..."});
                      res.end();
                    });
			      });
			    }
              });
            }
		});
	  }
	  catch(err) {
         endInError(err);
	  }

  });
});

router.get('/b/*', function(req,res) {
  var path = '.' + req.url;
  res.download(path, function() {
      res.end();
//      fs.unlink(path, function(err) {
//          if (err) {
//              console.log('Fout bij verwijderen: ' + err);
//          }
//          else
//          {
            // Status terggeven, customerID uit url plukken
//            pushClientStatus(req.url.split('/')[2]);
//          }
//      });
  });
});

var storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, './tmp');
  },
  filename: function (req, file, callback) {
    callback(null, file.fieldname);
  }
});

var upload = multer({ storage: storage }).single('templateFile');

router.post('/upload', upload, function (req, res, next) {
   //console.log(req.file);
   var found = false
     , i = 0;
   while (found == false && i < mimetypesArr.length)
   {
     if (mimetypesArr[i] == req.file.mimetype)
     {
      found = true;
    // res.redirect(req.header('Referer') || '/', function() {
    //    customerSockets[req.body.customerID].emit('message', {message:"Ready..."});
	// });
     }
	 else
       i++;
   }
   if (found == true)
   {
     fH.mv(req.file, 'b/' + req.body.customerID  + '/Templates', req.file.filename);
     customerSockets[req.body.customerID].emit('message', {message:"Ready..."});
   }
   else
   {
     customerSockets[req.body.customerID].emit('message', {message:"Sorry, wrong filetype..."});
   }
});

app.use('/', router);

// start the server
server.listen(port);
console.log('Server started! At http://localhost:' + port);