\ Default hot-reloadable tools used by the Realtime voice assistant.
\ Keep these actions reversible and safe for anyone standing near the rabbit.

: tool-move_ears ( args-json -- result )
  json-parse
  dup "left" json-get >r
  "right" json-get >r
  1 r> 1 move-ear
  0 r> 0 move-ear
  "ok" ;

: tool-set_led ( args-json -- result )
  json-parse
  dup "color" json-get swap "target" json-get
  dup "nose" = if
    drop led-nose ! "ok"
  else dup "left" = if
    drop led-left ! "ok"
  else dup "center" = if
    drop led-center ! "ok"
  else dup "right" = if
    drop led-right ! "ok"
  else dup "base" = if
    drop led-base ! "ok"
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

: tool-rabbit_status ( args-json -- result )
  drop
  nil
  "ora locale: " :: local>string ::
  ", orecchio sinistro: " ::
  ears >r >r r> ::
  ", orecchio destro: " :: r> ::
  ", in sonno: " :: sleeping? ::
  ", meteo: " :: info-weather @ ::
  str-join ;
