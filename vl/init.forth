"098f6bcd4621d373cade4e832627b4f6" set-md5-password

: login ( logged line -- logged )
md5 get-md5-password = if "logged" . else "Please login" . then cr
;

: prompt ( -- )
\ forth interpreter prompt
nil "[" :: depth 1 - :: "] > " :: str-join .
;

: interpreter ( -- )
\ interactive forth interpreter
"
*** ServerlessNabaztag ***
" . revision . "

Welcome to the interactive Forth system.
Type 'words' to see available words.
Type 'quit'  to exit the interpreter.

" .
begin
  prompt read-line  \ display the prompt and read a line
  dup "quit" = if   \ check if the line is 'quit'
    drop            \ drop the line
    1               \ exit
  else
    evaluate        \ evalute the line
    0               \ continue
  then
until
cr "Goodbye." . cr
;

: reload-init ( -- )
\ reload init.forth
nil server-url :: "/init.forth" :: str-join http-get
drop \ drop header
evaluate \ evaluate the content
;

: play-midi-acquired 0 play-midi ;

: play-midi-ack 4 play-midi ;

: hook-click ( -- )
\ click hook
nil "time=" :: time-ms :: str-join  \ payload
nil server-url :: "/hooks/click.php" :: str-join  \ url
http-post
drop drop
;

: hook-dbl-click ( -- )
\ double click url
play-midi-ack
nil "time=" :: time-ms :: str-join  \ payload
nil server-url :: "/hooks/dblclick.php" :: str-join  \ url
http-post
drop drop
;

: hook-ears ( -- )
\ ears hook
play-midi-acquired
nil "left=" :: left-ear-position :: "&right=" :: right-ear-position :: str-join  \ payload
nil server-url :: "/hooks/ears.php" :: str-join  \ url
http-post
drop drop
;

: get-hour ( -- hour )
\ get the current hour
time&date drop drop drop swap drop swap drop
;

: hook-time-sound ( -- )
sleeping invert if  \ if not sleeping
nil server-url :: "/config/clock/" :: language :: "/" :: get-hour :: "/" :: 6 random 1 + :: ".mp3" :: str-join  \ url
play-url
then
;

: hook-halftime-sound ( -- )
sleeping invert if  \ if not sleeping
nil server-url :: "/config/clockall/" :: language :: "/" :: 12 random 1 + :: ".mp3" :: str-join  \ url
play-url
then
;
