import { useState, useEffect } from "react";

const ProgressiveImg = ({ placeholderSrc, src, width, maxWidth, cursor, objectFit }) => {
    const [imgSrc, setImgSrc] = useState(placeholderSrc);

    useEffect(() => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            setImgSrc(src);
        };
    }, [src]);

    useEffect(() => {
        setImgSrc(placeholderSrc);
    }, [placeholderSrc]);

    return (
        <img
            {...{ src: imgSrc, width, cursor }}
            alt={""}
            style={{
                objectFit: objectFit,
                maxWidth: maxWidth,
                height: "96%",
                marginBottom: "2%",
                marginTop: "2%"
            }}
        />
    );
};
export default ProgressiveImg;