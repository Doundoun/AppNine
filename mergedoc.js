exports.merge = function (doc, mergeList, callback) {

    // Method fldSimple

    var mergexml = doc.getElementsByTagName('w:fldSimple'),
	    mergexmlLength = mergexml.length;
		
if (!mergeList) {console.log('bestaat dus niet wel');};
    for (i = 0; i < mergexmlLength; i++)
	{
		var InstrAttr = mergexml[i].getAttribute('w:instr');
		getMergeValue(InstrAttr, mergeList, function(mergeValue) {
  		  var newNode = doc.createElement("w:r"),
      	      newTextNode = doc.createElement("w:t");

      	  newTextNode.appendChild(doc.createTextNode(mergeValue));
      	  newNode.appendChild(newTextNode);

      	  mergexml[i].parentNode.replaceChild(newNode,mergexml[i]);
        });
	}

    //Method instrText	 
	mergexml = doc.getElementsByTagName('w:instrText');
	var mergexmlLength = mergexml.length;

    for (i = 0; i < mergexmlLength; i++)
      {  var textNodetoReplace = mergexml[i].childNodes[0];

        var nodeText = textNodetoReplace.toString();
        getMergeValue(nodeText, mergeList, function (mergeValue){
		   //Ga op zoek naar de node met tekst 'begin'
		   curNode = mergexml[i].parentNode;
				   
		   var wtAttributes = mergexml[i].attributes;
			   
 	       while (curNode.nodeName != 'w:r' && curNode.nodeName != 'w:body') {
				   curNode = curNode.parentNode;
		   }
	       // Maak clone om straks de hele bende te vervangen
	       var clonedNode = curNode.cloneNode(true);
           var newTextNode = doc.createElement("w:t");
	       for (k=0;k<wtAttributes.length;k++) {
			 newTextNode.setAttribute(wtAttributes[k].name, wtAttributes[k].value);
	       }

   	       newTextNode.appendChild(doc.createTextNode(mergeValue));

           clonedinstrTextNode = clonedNode.getElementsByTagName('w:instrText')[0];
	       clonedNode.removeChild(clonedinstrTextNode);
	       clonedNode.appendChild(newTextNode);
					   
	       // Op zoek naar de node met 'begin'
	       var beginFound = false;
				   
	       curNode = curNode.previousSibling;
					   
	       while (!beginFound && curNode) {
		     var fldChars = curNode.getElementsByTagName('w:fldChar');
		     for (j=0;j<=fldChars.length-1;j++) {
  		         var fldCharTypeAttr = fldChars[j].getAttribute('w:fldCharType');
			   if (fldCharTypeAttr == 'begin') { beginFound = true;};
		     }
		     if (!beginFound) (curNode = curNode.previousSibling);   
		   }
					   
           if (beginFound) {
 		     // Op zoek naar de node met 'end'
  		     var endFound = false;
		     // Nodes weggooien
		     var goAwayNode = curNode;
		     curNode = curNode.nextSibling;
		     doc.removeChild(goAwayNode);
	
	  	     while (!endFound && curNode) {
		       var fldChars = curNode.getElementsByTagName('w:fldChar');
		       for (j=0;j<=fldChars.length-1;j++) {
  			      var fldCharTypeAttr = fldChars[j].getAttribute('w:fldCharType');
			      if (fldCharTypeAttr == 'end') { endFound = true; };
		       };
	         if ( !endFound )
		      {
              //console.log('remove Node');
		      goAwayNode = curNode;
		      curNode = curNode.nextSibling;
		      doc.removeChild(goAwayNode);
 		      }
	        }
	        if (!endFound)
			  {console.log('Onverwachte XML structuur, [1]');
		      }
		    else
			  // Alleen de 'end' node nog aanwezig, die vervangen we
			  { curNode.parentNode.replaceChild(clonedNode,curNode);
			  }
          }
	  	  else {console.log('Onverwachte XML structuur, [2]');
	      }
       });
  }
  return callback(doc);
}

function getMergeValue(nodeText, mergeList, callback) {
	var mergeFieldOn = nodeText.search("MERGEFIELD");
	var docPropertyOn = nodeText.search("DOCPROPERTY");
					
	if ( mergeFieldOn != -1 || docPropertyOn != -1) {

	   if (mergeFieldOn != -1)  {fieldOffset = mergeFieldOn + 10};
       if (docPropertyOn != -1) {fieldOffset = docPropertyOn + 11};
		   
	   var mergeFieldEnd = nodeText.search("\\\*");
	      //console.log(nodeText);
	   var mergeFieldName = nodeText.substring(fieldOffset, mergeFieldEnd - 1)
	                                .trim()                         // trim spaties
									.replace(/^"(.*)"$/, '$1')      // trim 'dubbele quotes' aan begin en eind
									.replace(/\\"/g, '"');          // vervang ge-escapete 'dubbele quotes' in het midden
       if (mergeList[mergeFieldName])
	     {callback(mergeList[mergeFieldName]);}
	   else
	     {callback("");}
	}
	else
	{callback("");}
	}

