: load-info-animation ( filename anim_num -- ) \ Load info animation from the server
>r >r nil server-url @ :: "/" :: r> :: str-join
http-get drop json-parse
r> set-info-animation
;

: load-info-animations ( -- ) \ Load info animations from the server
\ nil server-url @ :: "/info_animations.json" :: str-join
\ http-get drop json-parse
\ dup "[0]" json-get 0 set-info-animation \ weather
\ dup "[1]" json-get 1 set-info-animation \ stock
\ dup "[2]" json-get 2 set-info-animation \ traffic
\ dup "[5]" json-get 5 set-info-animation \ mail
\     "[6]" json-get 6 set-info-animation \ pollution
"config/animation/weather.json" 0 load-info-animation
"config/animation/stock.json" 1 load-info-animation
"config/animation/traffic.json" 2 load-info-animation
"config/animation/mail.json" 5 load-info-animation
"config/animation/pollution.json" 6 load-info-animation
;
