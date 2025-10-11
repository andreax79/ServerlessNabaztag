#include <string.h>
#include <stdio.h>
#include <ctype.h>
#include <resolv.h>
#include <arpa/inet.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/select.h>
#include <netinet/in.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>

#include "../log.h"
#include"../properties.h"


#define HTTP_SERVER_BUFFER_SIZE 8*1024

/**
 * Sends a standard HTTP error response
 */
void http_server_send_error_response(int ns, int status_code, const char *status_message) {
    char response[HTTP_SERVER_BUFFER_SIZE];
    snprintf(response, sizeof(response),
             "HTTP/1.0 %d %s\r\n"
             "Content-Type: text/html\r\n\r\n"
             "<html><body><h1>%d %s</h1></body></html>",
             status_code, status_message, status_code, status_message);
    write(ns, response, strlen(response));
}

/**
 * Simple HTTP server to handle GET requests and serve files from "vl" directory
 */
int http_server(int ns) {
    char buffer[HTTP_SERVER_BUFFER_SIZE];
    size_t bytes_read;
    char *http_method;
    char *req_path;
    char *query_pos;
    char file_path[PATH_MAX];
    FILE *fp;

    bytes_read = read(ns, buffer, HTTP_SERVER_BUFFER_SIZE - 1);
    if (bytes_read >= 0) {
        buffer[bytes_read] = '\0';  // Null terminate the string
    } else {
        my_printf(LOG_HTTP_SERVER, "HTTP Server: Error reading the request (socket=%d) (%s)\n", ns, strerror(errno));
    }

    // Parse the HTTP Request
    http_method = strtok(buffer, " ");
    req_path = strtok(NULL, " ");

    if (http_method == NULL || req_path == NULL) {
        my_printf(LOG_HTTP_SERVER, "HTTP Server: 400 Bad Request\n");
        http_server_send_error_response(ns, 400, "Bad Request");
        close(ns);
        return 1;
    }

    // Only support GET method
    if (strcmp(http_method, "GET") != 0) {
        my_printf(LOG_HTTP_SERVER, "HTTP Server: %s %s 405 Method Not Allowed\n", http_method, req_path);
        http_server_send_error_response(ns, 405, "Method Not Allowed");
        close(ns);
        return 1;
    }

    // Remove query arguments if any
    query_pos = strchr(req_path, '?');
    if (query_pos) {
        *query_pos = '\0';
    }

    // Check for ".." in the path
    if (strstr(req_path, "..")) {
        my_printf(LOG_HTTP_SERVER, "HTTP Server: %s %s 404 File not found\n", http_method, req_path);
        http_server_send_error_response(ns, 404, "Not Found");
        close(ns);
        return 1;
    }

    // Serve the file
    if (strncmp(req_path, "/vl/", 4) == 0) {
        snprintf(file_path, sizeof(file_path), "%s%s", PropGet("HTTP_SERVER_PATH"), req_path + 3); // Skip "/vl"
    } else {
        snprintf(file_path, sizeof(file_path), "%s%s", PropGet("HTTP_SERVER_PATH"), req_path);
    }
    fp = fopen(file_path, "rb");
    if (fp == NULL) {
        my_printf(LOG_HTTP_SERVER, "HTTP Server: %s %s 404 File not found (%s)\n", http_method, req_path, file_path);
        http_server_send_error_response(ns, 404, "Not Found");
    } else {
        long file_size;

        my_printf(LOG_HTTP_SERVER, "HTTP Server: %s %s 200\n", http_method, req_path);

        // Get the file size
        fseek(fp, 0, SEEK_END);
        file_size = ftell(fp);
        fseek(fp, 0, SEEK_SET);

        // Send the response headers
        snprintf(buffer, sizeof(buffer),
                 "HTTP/1.1 200 OK\r\n"
                 "Content-Type: application/octet-stream\r\n"
                 "Content-Length: %ld\r\n"
                 "\r\n", // The blank line is crucial!
                 file_size);
        write(ns, buffer, strlen(buffer));

        // Send the file content
        while ((bytes_read = fread(buffer, 1, sizeof(buffer), fp)) > 0) {
            write(ns, buffer, bytes_read);
        }
        fclose(fp);
    }

    close(ns);
    return 1;
}
