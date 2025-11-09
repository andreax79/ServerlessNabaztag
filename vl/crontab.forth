: crontab
time-received? if
  sleeping? sleepig-time? invert and if wake-up then \ wake up
  get-minute
  dup 0 = if on-time then \ on hour
  30 = if on-halftime then \ on half hour
  sleeping? invert sleeping-time? and if sleep then \ time to sleep
then
;
