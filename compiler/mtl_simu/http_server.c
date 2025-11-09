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
#include <time.h>

#include "../log.h"
#include"../properties.h"


#define HTTP_SERVER_BUFFER_SIZE 8*1024

/**
 * Sends a standard HTTP error response
 */
void http_server_send_error_response(int ns, int status_code, const char *status_message) {
    char response[HTTP_SERVER_BUFFER_SIZE];
    char date[128];
    time_t now = time(NULL);
    struct tm tm;

    gmtime_r(&now, &tm);
    strftime(date, sizeof(date), "%a, %d %b %Y %H:%M:%S GMT", &tm);

    snprintf(response, sizeof(response),
             "HTTP/1.1 %d %s\r\n"
             "Date: %s\r\n"
             "Content-Type: text/html\r\n"
             "Pragma: no-cache\r\n"
             "Connection: close\r\n"
             "\r\n"
             "<html><body><h1>%d %s</h1></body></html>",
             status_code, status_message, date, status_code, status_message);
    write(ns, response, strlen(response));
}

static const char *TEXT_HTML = "text/html";
static const char *TEXT_CSS = "text/css";
static const char *APPLICATION_JAVASCRIPT = "application/javascript";
static const char *AUDIO_MPEG = "audio/mpeg";
static const char *AUDIO_WAV = "audio/wav";
static const char *IMAGE_PNG = "image/png";
static const char *IMAGE_JPEG = "image/jpeg";
static const char *IMAGE_GIF = "image/gif";
static const char *TEXT_PLAIN = "text/plain";
static const char *APPLICATION_OCTET_STREAM = "application/octet-stream";

/**
 * Determines the MIME type based on the file extension
 */
const char *http_server_get_mime_type(const char *req_path) {
    const char *file_extension = strrchr(req_path, '.');
    if (file_extension) {
        file_extension++; // Move past the dot
    } else {
        return APPLICATION_OCTET_STREAM; // No extension found
    }
    if (strcmp(file_extension, "html") == 0 || strcmp(file_extension, "htm") == 0) {
        return TEXT_HTML;
    } else if (strcmp(file_extension, "css") == 0) {
        return TEXT_CSS;
    } else if (strcmp(file_extension, "js") == 0) {
        return APPLICATION_JAVASCRIPT;
    } else if (strcmp(file_extension, "mp3") == 0) {
        return AUDIO_MPEG;
    } else if (strcmp(file_extension, "wav") == 0) {
        return AUDIO_WAV;
    } else if (strcmp(file_extension, "png") == 0) {
        return IMAGE_PNG;
    } else if (strcmp(file_extension, "jpg") == 0 || strcmp(file_extension, "jpeg") == 0) {
        return IMAGE_JPEG;
    } else if (strcmp(file_extension, "gif") == 0) {
        return IMAGE_GIF;
    } else if (strcmp(file_extension, "txt") == 0) {
        return TEXT_PLAIN;
    } else {
        return APPLICATION_OCTET_STREAM;
    };
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
        char date[128];
        time_t now = time(NULL);
        struct tm tm;

        gmtime_r(&now, &tm);
        strftime(date, sizeof(date), "%a, %d %b %Y %H:%M:%S GMT", &tm);

        my_printf(LOG_HTTP_SERVER, "HTTP Server: %s %s 200\n", http_method, req_path);

        // Get the file size
        fseek(fp, 0, SEEK_END);
        file_size = ftell(fp);
        fseek(fp, 0, SEEK_SET);

        // Send the response headers
        snprintf(buffer, sizeof(buffer),
                 "HTTP/1.1 200 OK\r\n"
                 "Date: %s\r\n"
                 "Content-Type: %s\r\n"
                 "Content-Length: %ld\r\n"
                 "Cache-Control: max-age=0, no-cache, no-store\r\n"
                 "Pragma: no-cache\r\n"
                 "Connection: close\r\n"
                 "\r\n",
                 date,
                 http_server_get_mime_type(req_path),
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
