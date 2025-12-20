: on-click ( -- )  \ Click hook
nil "time=" :: time-ms :: str-join  \ payload
nil server-url @ :: "/hooks/click.php" :: str-join  \ url
http-post
drop drop ;

: on-dbl-click ( -- )  \ Double click hook
play-midi-ack
nil "time=" :: time-ms :: str-join  \ payload
nil server-url @ :: "/hooks/dblclick.php" :: str-join  \ url
http-post
drop drop ;

: on-ears ( -- )  \ Ears hook
play-midi-acquired
nil "left=" :: left-ear-position :: "&right=" :: right-ear-position :: str-join  \ payload
nil server-url @ :: "/hooks/ears.php" :: str-join  \ url
http-post
drop drop ;

: on-time ( -- )  \ Hour hook
sleeping? invert if  \ if not sleeping
nil server-url @ :: "/config/clock/" :: language @ :: "/" :: get-hour :: "/" :: 6 random 1 + :: ".mp3" :: str-join  \ url
play-url
then ;

: on-halftime ( -- )  \ Half-hour hook
sleeping? invert if  \ if not sleeping
nil server-url @ :: "/config/clockall/" :: language @ :: "/" :: 12 random 1 + :: ".mp3" :: str-join  \ url
play-url
then ;

: on-rfid ( rfid -- )  \ RFID hook
>r
nil "tag=" :: >r :: str-join  \ payload
nil server-url @ :: "/hooks/rfid.php" :: str-join  \ url
http-post
drop drop ;

: say ( text --  )  \ Text to speech
sleeping? invert if  \ if not sleeping
url-encode >r
nil "http://translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&textlen=32&client=tw-ob&tl=" :: language @ :: "&q=" :: r> :: str-join \ url
play-url
then ;
