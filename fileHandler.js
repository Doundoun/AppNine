var fs    = require('fs')
  , mkdir = require('mkdirp');

exports.mv = function (file, destination, fileName) {
   mkdir('./' + destination, function (err) {
     var from   = fs.createReadStream(file.path)
       , pipe   = from.pipe(fs.createWriteStream('./' + destination + '/' + fileName));
       
     pipe.on('close', function() {
       fs.unlink(file.path);
     });
   });
}
