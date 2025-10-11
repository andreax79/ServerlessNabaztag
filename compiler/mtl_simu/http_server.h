#ifndef HTTP_SERVER_H_
#define HTTP_SERVER_H_

void http_server_send_error_response(int ns, int status_code, const char *status_message);
int http_server(int ns);

#endif
