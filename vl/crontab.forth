variable crontab-last-minute  \ store the last checked minute
variable surprise-next-time  \ store the next surprise time
120 60 * constant surprise-delay \ average delay, in seconds (delay= surprise-delay/2 + random*surprise-delay)

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
    then
    sleeping? invert sleeping-time? and if sleep then \ time to sleep
  else
    drop \ drop minute
  then
then ;

surprise-calculate-next-time \ initialize next surprise time
