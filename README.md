ServerlessNabaztag
==================

ServerlessNabaztag is a firmware allowing controling the Nabaztag/tag directly via web, without an external server (a web server is needed only for downloading the firmware and the mp3s).

With this firmware, you can connect at http://\<YOURNABAZTAGIP\>/ and completely control your rabbit with a very simple web interface, as show in the following screenshot:

![](/imgs/screenshot.jpg "Screenshot")

All the commands can be called with single HTTP requests from external program/script, example:

    curl http://nabaztag/wakeup
    
In examples/check_mail.py, there is a script that turns on the nose then you have unread email and changes the lights color according to the weather forecast.

Install instruction
-------------------

* Create a folder "vl" an a website
* Download the file web/vl/bc.jsp
* Copy the file "bc.jsp" to the web server into the "vl" folder (note: it's not a Java Server Page, it's a binary file)
* Download the mp3 files (as example, you can download from http://share.nekmo.com/python-nabaztag/mp3/zip/)
* Copy the mp3 files in the "vl/config" directory on the web server. The resulting directroy structure is the following:
 
![](/imgs/files.jpg "Directory structure")

* Unplug the rabbit, press the button on its head and hold it while you plug again your rabbit. When all the lights are blue, you canrelease the button
* On your computer, connect to the wifi network created by your rabbit (the name should be Nabaztag\<XX\>)
* Go to the configuration page at the following address: http://192.168.0.1 
* Change "Violet Platform" to the url of the  (without  
* At the bottom of the page, in General Info, change "Violet Platform" to the url of the vl directory (without http://, example: 192.168.0.1/vl)
* Click on Update settings and wait for rabbit reboot.
* You can now connect to the IP of your rabbit, configure and control it. (note: if your rabbit IP is assigned with DHCP, you have to discover the IP address. Usually you can check the assigned IP from some page on your router)

Firmware features
-----------------

* Control the rabbit via HTTP
* Congfigure the language and timezone via HTTP
* The rabbit fetches the current time from a time server and play the corresponding sound every hour
* Autonomously wake up at go to sleep
* Respond to ping request
