: between ( n low high -- flag )
>r over r> <= >r >= r> and ;

: login ( logged line -- logged )
md5 md5-password = if "logged" . else "Please login" . then cr ;

: prompt ( -- )
\ forth interpreter prompt
nil "[" :: depth 1 - :: "] > " :: str-join . ;

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
cr "Goodbye." . cr ;

: load-srv ( filename -- )
\ load a forth file from the server
>r nil server-url :: "/" :: r> :: str-join http-get
drop \ drop header
evaluate ; \ evaluate the content

: reload-init ( -- )
\ reload init.forth
"init.forth" load-srv ;

: play-midi-acquired 0 play-midi ;

: play-midi-ack 4 play-midi ;

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

: get-hour ( -- hour )
\ get the current hour
time&date drop drop drop swap drop swap drop ;

: on-time ( -- )
sleeping invert if  \ if not sleeping
nil server-url :: "/config/clock/" :: language :: "/" :: get-hour :: "/" :: 6 random 1 + :: ".mp3" :: str-join  \ url
play-url
then ;

: on-halftime ( -- )
sleeping invert if  \ if not sleeping
nil server-url :: "/config/clockall/" :: language :: "/" :: 12 random 1 + :: ".mp3" :: str-join  \ url
play-url
then ;

: surprise ( -- )
sleeping invert if  \ if not sleeping
nil server-url :: "/config/surprise/" :: language :: "/" :: 299 random 1 + :: ".mp3" :: str-join  \ url
play-url
then ;

: test
"http://localhost:8080/status" http-get drop json-parse
;

variable weather-code

: meteo>info ( n -- n )  \ convert weather code to info code
dup 0 = if drop 0 exit then
dup 3 <= if drop 1 exit then
dup 45 48 between if drop 2 exit then
dup 51 67 between if drop 3 exit then
dup 71 75 between if drop 4 exit then
dup 77 = if drop 4 exit then
dup 80 82 between if drop 3 exit then
dup 85 86 between if drop 4 exit then
dup 95 99 between if drop 5 exit then
drop nil ;

: on-weather-update ( -- )
latitude count 0<> longitude count 0<> and if
nil "http://api.open-meteo.com/v1/forecast?latitude=" :: latitude :: "&longitude=" :: longitude :: "&daily=weathercode&timezone=GMT&forecast_days=1" :: str-join \
http-get drop json-parse
"daily.weathercode[0]" json-get
dup weather-code !  \ store the weather code
meteo>info set-info-weather
then
;

\ load the configuration
"config.forth" load-srv

on-weather-update
