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

: get-hour ( -- hour )
\ get the current hour
time&date drop drop drop swap drop swap drop ;

: surprise ( -- )
sleeping? invert if  \ if not sleeping
nil server-url :: "/config/surprise/" :: language :: "/" :: 299 random 1 + :: ".mp3" :: str-join  \ url
play-url
then ;

: sleeping-time? ( -- flag )
get-hour
dup \ dup hour
wake-up-at <
swap \ swap hour and flag
go-to-bed-at >=
or
;

"hooks.forth" load-srv
"weather.forth" load-srv
"config.forth" load-srv

: on-connect ( -- )
update-weather
sleeping-time? if sleep else wake-up then
"update-weather" weather-time-delay "weather" task-start
;
