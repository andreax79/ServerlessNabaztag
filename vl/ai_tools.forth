\ Default hot-reloadable tools used by the Realtime voice assistant.
\ Keep these actions reversible and safe for anyone standing near the rabbit.
\ Protocol: a tool returns a machine-readable string for the model.
\ Start it with "ok" on success or "error:" on failure; the model phrases the
\ spoken confirmation in the user's language.

variable ai-tool-left
variable ai-tool-right
variable ai-tool-actual-left
variable ai-tool-actual-right
variable ai-tool-left-broken
variable ai-tool-right-broken

: ai-read-ear-health ( -- )
  0 ear-broken? ai-tool-left-broken !
  1 ear-broken? ai-tool-right-broken ! ;

: ai-valid-ear-target? ( target -- flag )
  dup nil = if drop 0 exit then
  dup -2 >= swap 16 <= and ;

: ai-valid-led-color? ( color -- flag )
  dup nil = if drop 0 exit then
  dup -1 >= swap 16777215 <= and ;

: ai-shortest-ear-dir ( current target -- dir )
  swap - 17 + 17 mod 8 > if 1 else 0 then ;

: ai-ears-arrived ( -- flag )
  ears ai-tool-right @ = swap ai-tool-left @ = and ;

\ MS carries ~200 ms of scheduler overhead per call (measured on device), so
\ the wait must be a single computed sleep, not a poll loop: the firmware
\ kills any tool that runs longer than 5 s.
: ai-ear-steps ( current target -- n )  \ steps along the shortest path
  swap - 17 + 17 mod dup 8 > if 17 swap - then ;

: ai-ears-travel-ms ( -- ms )  \ generous estimate of the longest ear travel
  ai-tool-actual-left @ ai-tool-left @ ai-ear-steps
  ai-tool-actual-right @ ai-tool-right @ ai-ear-steps
  max dup 0 = if exit then 300 * 700 + 3000 min ;

: tool-move_ears ( args-json -- result )
  json-parse
  dup "left" json-get ai-tool-left !
  "right" json-get ai-tool-right !
  ai-tool-left @ ai-valid-ear-target?
  ai-tool-right @ ai-valid-ear-target? and invert if
    "error: ear targets must be integers from -2 to 16" exit
  then
  ears ai-tool-actual-right ! ai-tool-actual-left !
  \ -1 advances one step, -2 or a missing value keeps the current position
  ai-tool-left @ -1 = if ai-tool-actual-left @ 1+ 17 mod ai-tool-left ! then
  ai-tool-right @ -1 = if ai-tool-actual-right @ 1+ 17 mod ai-tool-right ! then
  ai-tool-left @ -2 = ai-tool-left @ nil = or if ai-tool-actual-left @ ai-tool-left ! then
  ai-tool-right @ -2 = ai-tool-right @ nil = or if ai-tool-actual-right @ ai-tool-right ! then
  ai-read-ear-health
  ai-tool-left-broken @ ai-tool-left @ ai-tool-actual-left @ <> and
  ai-tool-right-broken @ ai-tool-right @ ai-tool-actual-right @ <> and or if
    nil "error: cannot move ears while firmware health flag is set; left broken=" ::
    ai-tool-left-broken @ :: " right broken=" :: ai-tool-right-broken @ :: str-join exit
  then
  ai-tool-actual-right @ ai-tool-right @ ai-shortest-ear-dir
  ai-tool-right @ 1 move-ear
  ai-tool-actual-left @ ai-tool-left @ ai-shortest-ear-dir
  ai-tool-left @ 0 move-ear
  ai-ears-travel-ms ms
  ai-ears-arrived invert if 600 ms then
  ears ai-tool-actual-right ! ai-tool-actual-left !
  ai-ears-arrived if
    nil "ok: ears at left=" :: ai-tool-actual-left @ ::
    " right=" :: ai-tool-actual-right @ :: str-join
  else
    nil "error: ears did not reach the target in time; requested left=" ::
    ai-tool-left @ :: " right=" :: ai-tool-right @ ::
    ", current left=" :: ai-tool-actual-left @ ::
    " right=" :: ai-tool-actual-right @ ::
    " (an ear may be blocked or still moving)" :: str-join
  then ;

: tool-set_led ( args-json -- result )
  json-parse
  dup "color" json-get swap "target" json-get
  over ai-valid-led-color? invert if
    drop drop "error: LED color must be an integer from -1 to 16777215" exit
  then
  dup "nose" = if
    drop dup led-nose ! led-nose @ = if
      nil "ok: nose LED override=" :: led-nose @ :: str-join
    else "error: nose LED was not applied" then
  else dup "left" = if
    drop dup led-left ! led-left @ = if
      nil "ok: left LED override=" :: led-left @ :: str-join
    else "error: left LED was not applied" then
  else dup "center" = if
    drop dup led-center ! led-center @ = if
      nil "ok: center LED override=" :: led-center @ :: str-join
    else "error: center LED was not applied" then
  else dup "right" = if
    drop dup led-right ! led-right @ = if
      nil "ok: right LED override=" :: led-right @ :: str-join
    else "error: right LED was not applied" then
  else dup "base" = if
    drop dup led-base ! led-base @ = if
      nil "ok: base LED override=" :: led-base @ :: str-join
    else "error: base LED was not applied" then
  else
    drop drop "error: unknown LED target"
  then then then then then ;

: tool-play_sound ( args-json -- result )
  json-parse "sound" json-get
  dup "acquired" = if
    drop 0 play-midi "ok"
  else dup "ack" = if
    drop 4 play-midi "ok"
  else dup "abort" = if
    drop 2 play-midi "ok"
  else dup "random" = if
    drop -1 play-midi "ok"
  else
    drop "error: unknown sound"
  then then then then ;

: ai-weather>text ( code -- text )
  dup nil = if drop "unavailable" exit then
  dup 0 = if drop "clear" exit then
  dup 1 = if drop "cloudy" exit then
  dup 2 = if drop "fog" exit then
  dup 3 = if drop "rain" exit then
  dup 4 = if drop "snow" exit then
  dup 5 = if drop "storm" exit then
  drop "unavailable" ;

: ai-sleep>text ( flag -- text )
  if "sleeping" else "awake" then ;

: tool-rabbit_status ( args-json -- result )
  drop
  ears ai-tool-actual-right ! ai-tool-actual-left !
  ai-read-ear-health
  nil
  "ok: local time: " :: local>string ::
  ", state: " :: sleeping? ai-sleep>text ::
  ai-tool-left-broken @ if
    ", left ear: broken, unreliable last reading=" ::
  else
    ", left ear position: " ::
  then
  ai-tool-actual-left @ ::
  ai-tool-right-broken @ if
    ", right ear: broken, unreliable last reading=" ::
  else
    ", right ear position: " ::
  then
  ai-tool-actual-right @ ::
  ", weather: " :: info-weather @ ai-weather>text ::
  str-join ;
