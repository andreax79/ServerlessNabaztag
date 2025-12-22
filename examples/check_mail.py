#!/usr/bin/python
# 3 Nov 2012 - Andrea Bonomi - <andrea.bonomi@gmail.com>
# https://github.com/andreax79/ServerlessNabaztag

# 1) Turn on the nose when you have unread mails
# [obsolete] 2) Change the lights according to the weather forecast

# ----------------------------------------------------------
# IMAP config
username = '...'
password = '...'
server = 'imap.gmail.com'
port = 993
nabaztag_address = '192.168.1.252'
# weather config
city = 'milano'
# ----------------------------------------------------------

import socket
import urllib2
import imaplib
try:
    import simplejson as json
except ImportError:
    import json

timeout = 10 # socket timeout in seconds
socket.setdefaulttimeout(timeout)
imap_server = imaplib.IMAP4_SSL(server, port)
imap_server.login(username, password)
imap_server.select('INBOX')

# Count the unread emails
status, response = imap_server.status('INBOX', "(UNSEEN)")
unreadcount = int(response[0].split()[2].strip(').,]'))

if unreadcount:
    cmd = "nose?v=1" # turn on the nose
else:
    cmd = "nose?v=0" # turn off the nose

base_url = 'http://' + nabaztag_address + '/'
req = urllib2.Request(base_url + cmd)
urllib2.urlopen(req)

# [obsolete] - Fetch the weather from openweathermap.org
# data = urllib2.urlopen('http://api.openweathermap.org/data/2.5/forecast/daily?mode=json&units=metric&cnt=1&q=' + city).read()
# data = json.loads(data)
# weather_id = data["list"][0]["weather"][0]["id"]
# v = 100
# if weather_id == 800:
#     v = 0 # sun
# elif weather_id >= 801 and weather_id <= 899:
#     v = 1 # cloud
# elif weather_id >= 701 and weather_id <= 799:
#     v = 2 # fog
# elif (weather_id >= 200 and weather_id <= 299) or (weather_id >= 300 and weather_id <= 399) or (weather_id >= 500 and weather_id <= 599):
#     v = 3 # rain
# elif weather_id >= 600 and weather_id <= 699:
#     v = 4 # snow
# elif weather_id >= 900 and weather_id <= 999:
#     v = 5 # storm
#
# urllib2.urlopen(base_url + "weather?v=%s" % v)
