: load-srv ( filename -- )  \ Load a forth file from the server
>r nil server-url @ :: "/" :: r> :: str-join http-get
drop \ drop header
evaluate ; \ evaluate the content

"core.forth" load-srv

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

: stop-script-tasks ( -- ) \ Stop stale Forth script tasks after init reloads
\ Task 20 is the native AI state machine; script tasks start after it.
36 21 do
  i task-stop drop
loop ;

"config.forth" load-srv
"consts.forth" load-srv
"ai_tools.forth" load-srv
"hooks.forth" load-srv
"weather.forth" load-srv
"telnet.forth" load-srv
"crontab.forth" load-srv
"choreography.forth" load-srv
\ "palette.forth" load-srv

: on-connect ( -- )
"interpreter" 23 "telnet" tcp-listen  \ start telnet server
"daytime" 21 "daytime" tcp-listen  \ start daytime server
stop-script-tasks
"update-weather" weather-time-delay "weather" task-start \ start weather update
"crontab" 59000 "crontab" task-start  \ start crontab
crontab
update-weather
sleeping-time? if sleep else wake-up then
;
