window.onload = function() {

  var custIdVal = "";
  
// Haal de customerID uit de URL en zet in hidden form-item
    var url = window.location.search.substring(1); //get rid of "?" in querystring
    var qArray = url.split('&'); //get key-value pairs
    var pArr = qArray[0].split('=');
	if (pArr[0] == 'customerID') {
		var custID = document.getElementById('customerID');
		custID.setAttribute("value", pArr[1]); console.log('iframe custID: ' + custID.getAttribute("value"));
        custIdVal = pArr[1];        
	}
 //   for (var i = 0; i < qArray.length; i++) 
 //   {
 //       var pArr = qArray[i].split('='); //split key and value
 //       if (pArr[0] == paramName) 
 //           return pArr[1]; //return value
 //   }

var socket = io.connect('http://localhost:3000')
//  var socket = io.connect('https://www.doxervu.com')
    , status = document.getElementById("status")
    , dirlistdiv = document.getElementById("fileList");

var setDirList = function (dirList) {
    var listHTML = '';
	if (dirList.length == 0) {listHTML = '<li>None</li>';}
	else
    { for (i=0; i<dirList.length;i++)
      {
        listHTML = listHTML + '<li><a href="b/' + custIdVal + '/' + dirList[i] + '">' + dirList[i] + '</a></li>';
      }
	}
    dirlistdiv.innerHTML = '<p><ul>' + listHTML + '</ul></p>';
};

socket.on('handshake', function (data, callback) {
      callback(custIdVal);
      if (data.message) {
          status.innerHTML = '<p>' + data.message + '</p>';
      }
});
  
socket.on('dirlist', function(dirList) {
	 setDirList(dirList.dirlist);
     if (dirList.message)
     {
       status.innerHTML = '<p>' + dirList.message + '</p>';
     }
});

socket.on('message', function (data) {
           if (data.message) {
            status.innerHTML = '<p>' + data.message + '</p>';
            }
          else {
            console.log("There is a problem:", data);
            }
});

};
