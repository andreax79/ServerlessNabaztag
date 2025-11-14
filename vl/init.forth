: between ( n low high -- flag )
>r over r> <= >r >= r> and ;

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

: get-minute ( -- minute )
time&date drop drop drop drop swap drop ;

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
or ;

: daytime ( -- )
time&date-utc$ . cr ;

"config.forth" load-srv
"hooks.forth" load-srv
"weather.forth" load-srv
"telnet.forth" load-srv
"crontab.forth" load-srv

: on-connect ( -- )
"interpreter" 23 "telnet" tcp-listen  \ start telnet server
"daytime" 21 "daytime" tcp-listen  \ start daytime server
"update-weather" weather-time-delay "weather" task-start \ start weather update
"crontab" 60000 "crontab" task-start  \ start crontab
\ update-weather
sleeping-time? if sleep else wake-up then
;
