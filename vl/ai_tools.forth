\ Default hot-reloadable tools used by the Realtime voice assistant.
\ Keep these actions reversible and safe for anyone standing near the rabbit.

variable ai-tool-left
variable ai-tool-right
variable ai-tool-actual-left
variable ai-tool-actual-right

: tool-move_ears ( args-json -- result )
  json-parse
  dup "left" json-get ai-tool-left !
  "right" json-get ai-tool-right !
  1 ai-tool-right @ 1 move-ear
  0 ai-tool-left @ 0 move-ear
  3000 ms
  ears ai-tool-actual-right ! ai-tool-actual-left !
  ai-tool-left @ ai-tool-actual-left @ =
  ai-tool-right @ ai-tool-actual-right @ = and if
    "ok: entrambe le orecchie hanno raggiunto la posizione richiesta"
  else
    nil
    "error: posizione richiesta sinistra=" :: ai-tool-left @ ::
    " destra=" :: ai-tool-right @ ::
    "; posizione raggiunta sinistra=" :: ai-tool-actual-left @ ::
    " destra=" :: ai-tool-actual-right @ :: str-join
  then ;

: tool-set_led ( args-json -- result )
  json-parse
  dup "color" json-get swap "target" json-get
  dup "nose" = if
    drop dup led-nose ! led-nose @ = if "ok" else "error: LED nose non verificato" then
  else dup "left" = if
    drop dup led-left ! led-left @ = if "ok" else "error: LED left non verificato" then
  else dup "center" = if
    drop dup led-center ! led-center @ = if "ok" else "error: LED center non verificato" then
  else dup "right" = if
    drop dup led-right ! led-right @ = if "ok" else "error: LED right non verificato" then
  else dup "base" = if
    drop dup led-base ! led-base @ = if "ok" else "error: LED base non verificato" then
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
  dup nil = if drop "non disponibile" exit then
  dup 0 = if drop "sereno" exit then
  dup 1 = if drop "variabile o coperto" exit then
  dup 2 = if drop "nebbia" exit then
  dup 3 = if drop "pioggia" exit then
  dup 4 = if drop "neve" exit then
  dup 5 = if drop "temporale" exit then
  drop "non disponibile" ;

: ai-sleep>text ( flag -- text )
  if "in sonno" else "sveglio" then ;

: tool-rabbit_status ( args-json -- result )
  drop
  ears ai-tool-actual-right ! ai-tool-actual-left !
  nil
  "ora locale: " :: local>string ::
  ", stato: " :: sleeping? ai-sleep>text ::
  ", posizione orecchio sinistro: " :: ai-tool-actual-left @ ::
  ", posizione orecchio destro: " :: ai-tool-actual-right @ ::
  ", meteo: " :: info-weather @ ai-weather>text ::
  str-join ;
