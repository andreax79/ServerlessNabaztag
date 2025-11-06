: on-click ( -- )
\ click hook
nil "time=" :: time-ms :: str-join  \ payload
nil server-url :: "/hooks/click.php" :: str-join  \ url
http-post
drop drop ;

: on-dbl-click ( -- )
\ double click url
play-midi-ack
nil "time=" :: time-ms :: str-join  \ payload
nil server-url :: "/hooks/dblclick.php" :: str-join  \ url
http-post
drop drop ;

: on-ears ( -- )
\ ears hook
play-midi-acquired
nil "left=" :: left-ear-position :: "&right=" :: right-ear-position :: str-join  \ payload
nil server-url :: "/hooks/ears.php" :: str-join  \ url
http-post
drop drop ;

: on-time ( -- )
sleeping? invert if  \ if not sleeping
nil server-url :: "/config/clock/" :: language :: "/" :: get-hour :: "/" :: 6 random 1 + :: ".mp3" :: str-join  \ url
play-url
then ;

: on-halftime ( -- )
sleeping? invert if  \ if not sleeping
nil server-url :: "/config/clockall/" :: language :: "/" :: 12 random 1 + :: ".mp3" :: str-join  \ url
play-url
then ;
