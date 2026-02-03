: load-info-animation ( filename anim_num -- ) \ Load info animation from the server
>r >r nil server-url @ :: "/" :: r> :: str-join
http-get drop json-parse
r> set-info-animation
;

: load-info-animations ( -- ) \ Load info animations from the server
nil server-url @ :: "/info_animations.json" :: str-join
http-get drop json-parse .s
dup "[1]" json-get 1 set-info-animation \ weather
dup "[2]" json-get 2 set-info-animation \ stock
dup "[3]" json-get 3 set-info-animation \ traffic
dup "[4]" json-get 4 set-info-animation \ generic 4
dup "[5]" json-get 5 set-info-animation \ generic 5
dup "[6]" json-get 6 set-info-animation \ mail
    "[7]" json-get 7 set-info-animation \ pollution
\ "config/animation/weather.json" 1 load-info-animation
\ "config/animation/stock.json" 2 load-info-animation
\ "config/animation/traffic.json" 3 load-info-animation
\ "config/animation/mail.json" 6 load-info-animation
\ "config/animation/pollution.json" 7 load-info-animation
;
