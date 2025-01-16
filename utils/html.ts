export function catErrorPage(errorCode: number) {
    return `<body style="background:black"><img style="display:block;margin:10vh auto" src="https://http.cat/${errorCode}.jpg"><body/>`;
}

export function fullScreenImagePage(src: string) {
    return `<html><body><img style="width: 100vw;height:100vh;" src="${src}"></body></html>`;
}
