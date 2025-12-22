variable crontab-last-minute  \ Crontab last checked minute
variable surprise-next-time  \ Next surprise time
120 60 * constant surprise-delay \ Surprise average delay, in seconds (delay= surprise-delay/2 + random*surprise-delay)
variable taichi-next-time  \ Next taichi time

: surprise ( -- )  \ Surprise
sleeping? invert if  \ if not sleeping
nil server-url @ :: "/config/surprise/" :: language @ :: "/" :: 299 random 1 + :: ".mp3" :: str-join  \ url
play-url
then ;

: calc-surprise ( -- ) \ calculate next surprise time
surprise-delay 2 /
surprise-delay random +
uptime +
surprise-next-time ! ;

: surprise-time? ( -- flag ) \ Check if it's time for a surprise
surprise-next-time @ uptime < ;

: taichi  ( -- )  \ Do Tai Chi exercise
sleeping? invert if  \ if not sleeping
nil server-url @ :: "/config/chor/taichi.chor" :: str-join
http-get
drop \ drop header
play-chor
then ;

: calc-taichi ( -- ) \ Calculate next taichi time
taici-freq @
case
255 of 255 endof
 40 of  40 endof
        80
endcase
60 *
127 random 64 + *
128 /
uptime +
taichi-next-time ! ;

: taichi-time? ( -- flag ) \ check if it's time for taichi
taichi-next-time @ uptime < ;

: crontab ( -- )  \ Crontab
time? if
  get-minute
  dup crontab-last-minute @ <> if
    dup crontab-last-minute ! \ update last checked minute
    sleeping? sleeping-time? invert and if wake-up then \ wake up
    dup 0 = if on-time then \ on hour
    30 = if on-halftime then \ on half hour
    surprise-time? if
      surprise
      calc-surprise
    else
      taichi-time? if
        taichi
        calc-taichi
      then
    then
    sleeping? invert sleeping-time? and if sleep then \ time to sleep
  else
    drop \ drop minute
  then
then ;

calc-surprise \ initialize next surprise time
calc-taichi  \ initialize next taichi time
