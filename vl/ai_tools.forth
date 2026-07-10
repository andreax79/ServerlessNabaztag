\ Default hot-reloadable tools used by the Realtime voice assistant.
\ Keep these actions reversible and safe for anyone standing near the rabbit.

variable ai-tool-left
variable ai-tool-right
variable ai-tool-actual-left
variable ai-tool-actual-right
variable ai-tool-left-broken
variable ai-tool-right-broken

: ai-read-ear-health ( -- )
  nil "http://" :: ip :: "/status" :: str-join
  http-get drop json-parse
  dup "ears.left.broken" json-get ai-tool-left-broken !
  "ears.right.broken" json-get ai-tool-right-broken ! ;

: ai-shortest-ear-dir ( current target -- dir )
  swap - 17 + 17 mod 8 > if 1 else 0 then ;

: tool-move_ears ( args-json -- result )
  json-parse
  dup "left" json-get ai-tool-left !
  "right" json-get ai-tool-right !
  ears ai-tool-actual-right ! ai-tool-actual-left !
  ai-tool-left @ -1 = if ai-tool-actual-left @ 1+ 17 mod ai-tool-left ! then
  ai-tool-right @ -1 = if ai-tool-actual-right @ 1+ 17 mod ai-tool-right ! then
  ai-tool-left @ -2 = if ai-tool-actual-left @ ai-tool-left ! then
  ai-tool-right @ -2 = if ai-tool-actual-right @ ai-tool-right ! then
  ai-tool-actual-right @ ai-tool-right @ ai-shortest-ear-dir
  ai-tool-right @ 1 move-ear
  ai-tool-actual-left @ ai-tool-left @ ai-shortest-ear-dir
  ai-tool-left @ 0 move-ear
  nil
  "started: richiesta sinistra=" :: ai-tool-left @ ::
  " destra=" :: ai-tool-right @ :: str-join ;

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
  ai-read-ear-health
  nil
  "ora locale: " :: local>string ::
  ", stato: " :: sleeping? ai-sleep>text ::
  ai-tool-left-broken @ if
    ", orecchio sinistro: guasto, ultima lettura non affidabile=" ::
  else
    ", posizione orecchio sinistro: " ::
  then
  ai-tool-actual-left @ ::
  ai-tool-right-broken @ if
    ", orecchio destro: guasto, ultima lettura non affidabile=" ::
  else
    ", posizione orecchio destro: " ::
  then
  ai-tool-actual-right @ ::
  ", meteo: " :: info-weather @ ai-weather>text ::
  str-join ;
