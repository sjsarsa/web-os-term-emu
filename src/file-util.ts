export const blobToBase64 = (blob: Blob): Promise<string | ArrayBuffer> => {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onloadend = function () {
            resolve(reader.result)
        }
    })
}

