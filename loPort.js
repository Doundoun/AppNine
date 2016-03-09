var libreOfficePorts = [2002,2003]
,   nrOfPorts = libreOfficePorts.length;

exports.next = function() {
   if (!global.loPortIndex)
	   {global.loPortIndex = 0;}
   else
       {if (global.loPortIndex = nrOfPorts - 1)
		    {global.loPortIndex = 0;}
        else
			{global.loPortIndex++;}
       }
   return libreOfficePorts[global.loPortIndex];
}
