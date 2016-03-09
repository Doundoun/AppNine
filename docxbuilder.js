var xmldom = require('xmldom')
  , DOMParser = xmldom.DOMParser
  , XMLSerializer = xmldom.XMLSerializer
  , unzip = require('unzip')
  , archiver    = require('archiver')
  , concat = require('concat-stream')
  , fs = require('fs')
  , mergedoc = require('./mergedoc');


exports.build = function(filePath, mergeList, callback) {

  fs.stat(filePath, function(err) {
       if (err) {
         return callback(err);
       }
    });
  
  try {
    var archive = archiver.create('zip', {})
	  , zipStream = fs.createReadStream(filePath).pipe(unzip.Parse());

    zipStream
      .on('entry', function (entry) {
        //  console.log(entry.path);
		  
	      var fileName = entry.path;
          if (fileName == "word/document.xml" ||
 		      fileName == "[Content_Types].xml" ||
			 (fileName.match('^word/header') != null) ||
			 (fileName.match('^word/footer') != null)
			 ) {

			function gotDoc(docBuffer) {
                var xmldoc = docBuffer.toString('utf8')
	              , doc = new DOMParser().parseFromString(xmldoc ,'text/xml');

                function appendToArchive(resultDoc) {
                  var serializer = new XMLSerializer()
                    , sXML = serializer.serializeToString(resultDoc);
 	              archive.append( sXML, JSON.parse( '{ "name" : "' + fileName + '" }' ));
                }

				if (fileName == "word/document.xml" ||
				   (fileName.match('^word/header') != null) ||
				   (fileName.match('^word/footer') != null)
				   ) {
					var resultDoc;
					mergedoc.merge(doc, mergeList, function(resultDoc) {appendToArchive(resultDoc);});
				}
				else if (fileName == "[Content_Types].xml") {
				   // Regel opvangen ter bepaling ContentType Template (dotx) of Document (docx)
				   var overRides = doc.getElementsByTagName('Override');
				   
				   var thisIsMyPart = false,
				       i = 0;
				   while (!thisIsMyPart && overRides[i]) {
					   var partName = overRides[i].getAttributeNode("PartName");
					   if (partName.value == "/word/document.xml") {
						   thisIsMyPart = true;
						   contentTypeAttr = overRides[i].getAttributeNode("ContentType");
						   if (contentTypeAttr.value.search("wordprocessingml.template") != -1) {
							  // isTemplate = true;
							   overRides[i].setAttribute(contentTypeAttr.name, contentTypeAttr.value.replace("wordprocessingml.template","wordprocessingml.document"));
							   }
					   }
				       i++;
				   }
			 	   appendToArchive(doc);
				}
			}

		     var concatStream = concat(gotDoc);
		     entry.pipe(concatStream);
		  }
	      else
		  { 
		    var nameJSON = JSON.parse('{ "name" : "' + entry.path + '" }');
		    archive.append(entry, nameJSON, function() {entry.autodrain();});
          }
	  
	     });

		 zipStream.on('close', function() { 
		    archive.finalize();
			callback(null,archive);
		 });
    }
   catch(err)
   { callback(err);
   }
  };
