: between ( n low high -- flag )
>r over r> <= >r >= r> and ;

: 2drop ( x1 x2 -- )
drop drop ;

: 2dup ( x1 x2 -- x1 x2 x1 x2 )
over over ;

: 2over ( x1 x2 x3 x4 -- x1 x2 x3 x4 x1 x2 )
3 pick 3 pick ;

: 2swap ( x1 x2 x3 x4 -- x3 x4 x1 x2 )
rot >r rot r> ;

: load-srv ( filename -- )  \ Load a forth file from the server
>r nil server-url @ :: "/" :: r> :: str-join http-get
drop \ drop header
evaluate ; \ evaluate the content

: reload-init ( -- )  \ Reload init.forth
"init.forth" load-srv ;

: play-midi-acquired 0 play-midi ;

: play-midi-ack 4 play-midi ;

: load-info-animation ( filename anim_num -- ) \ Load info animation from the server
>r >r nil server-url @ :: "/" :: r> :: str-join
http-get drop json-parse
r> set-info-animation
;

: get-hour ( -- hour )  \ Get the current hour
time&date drop drop drop swap drop swap drop ;

: get-minute ( -- minute )  \ Get the current minute
time&date drop drop drop drop swap drop ;

: sleeping-time? ( -- flag )  \ Check if current hour is in the sleep interval
wake-up-at @ go-to-bed-at @ = if  \ always awake if equal
  false
else
  get-hour
  dup \ dup hour
  wake-up-at @ <
  swap \ swap hour and flag
  go-to-bed-at @ >=
  or
then ;

: daytime ( -- )  \ Display the current time (UTC)
utc>string . cr ;

"config.forth" load-srv
"consts.forth" load-srv
"hooks.forth" load-srv
"weather.forth" load-srv
"telnet.forth" load-srv
"crontab.forth" load-srv
\ "palette.forth" load-srv
\ "choreography.forth" load-srv

: on-connect ( -- )
"interpreter" 23 "telnet" tcp-listen  \ start telnet server
"daytime" 21 "daytime" tcp-listen  \ start daytime server
"update-weather" weather-time-delay "weather" task-start \ start weather update
"crontab" 59000 "crontab" task-start  \ start crontab
crontab
update-weather
sleeping-time? if sleep else wake-up then
;
