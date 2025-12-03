variable crontab-last-minute  \ store the last checked minute
variable surprise-next-time  \ store the next surprise time
120 60 * constant surprise-delay \ average delay, in seconds (delay= surprise-delay/2 + random*surprise-delay)
variable taichi-next-time  \ store the next taichi time

: surprise ( -- )
sleeping? invert if  \ if not sleeping
nil server-url @ :: "/config/surprise/" :: language @ :: "/" :: 299 random 1 + :: ".mp3" :: str-join  \ url
play-url
then ;

: surprise-calculate-next-time ( -- ) \ calculate next surprise time
surprise-delay 2 /
surprise-delay random +
uptime +
surprise-next-time ! ;

: surprise-time? ( -- flag ) \ check if it's time for a surprise
surprise-next-time @ uptime < ;

: taichi  ( -- )
nil server-url @ :: "/config/chor/taichi.chor" :: str-join
http-get
drop \ drop header
play-chor
;

: taichi-calculate-next-time ( -- ) \ calculate next taichi time
info-taici @
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

: crontab ( -- )
time? if
  get-minute
  dup crontab-last-minute @ <> if
    dup crontab-last-minute ! \ update last checked minute
    sleeping? sleeping-time? invert and if wake-up then \ wake up
    dup 0 = if on-time then \ on hour
    30 = if on-halftime then \ on half hour
    surprise-time? if
      surprise
      surprise-calculate-next-time
    else
      taichi-time? if
        taichi
        taichi-calculate-next-time
      then
    then
    sleeping? invert sleeping-time? and if sleep then \ time to sleep
  else
    drop \ drop minute
  then
then ;

surprise-calculate-next-time \ initialize next surprise time
taichi-calculate-next-time  \ initialize next taichi time
