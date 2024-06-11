export function catErrorPage(errorCode: number) {
    return `<body style="background:black"><img style="display:block;margin:10vh auto" src="https://http.cat/${errorCode}.jpg"><body/>`;
}
