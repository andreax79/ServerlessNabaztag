variable weather-code  \ Weather code
variable eaiq  \ European Air Quality Index

60 60 * 1000 * constant weather-time-delay \ 1 hour

: meteo>info ( n -- n )  \ Convert weather code to info code
dup 0 = if drop 0 exit then
dup 3 <= if drop 1 exit then
dup 45 48 between if drop 2 exit then
dup 51 67 between if drop 3 exit then
dup 71 75 between if drop 4 exit then
dup 77 = if drop 4 exit then
dup 80 82 between if drop 3 exit then
dup 85 86 between if drop 4 exit then
dup 95 99 between if drop 5 exit then
drop nil ;

: eaiq>info ( n -- n )  \ Convert European Air Quality Index (AQI)
  10 /
  10 min
;

: update-weather ( -- )  \ Update weather and air quality information
latitude @ count 0<> longitude @ count 0<> and if
  nil "http://api.open-meteo.com/v1/forecast?latitude=" :: latitude @ :: "&longitude=" :: longitude @ :: "&daily=weathercode&timezone=GMT&forecast_days=1" :: str-join \
  http-get drop json-parse
  "daily.weathercode[0]" json-get
  dup weather-code !  \ store the weather code
  meteo>info info-weather !
  \ air quality
  nil "http://air-quality-api.open-meteo.com/v1/air-quality?latitude=" :: latitude @ :: "&longitude=" :: longitude @ :: "&current=european_aqi&forecast_days=1" :: str-join \
  http-get drop json-parse
  "current.european_aqi" json-get
  dup eaiq !  \ store the eaiq
  dup nil <> if eaiq>info info-pollution ! then
then
;
