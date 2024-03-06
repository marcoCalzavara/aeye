import {useEffect, useState} from "react";

const ProgressiveImg = ({placeholderSrc, src, width, height, margin}) => {
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
        <div style={{
            marginTop: margin,
            marginBottom: margin,
            width: width,
            height: height
        }}>
            <img
                {...{src: imgSrc}}
                alt={"Main image"}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "fill",
                    borderRadius: "5px"
                }}
            />
        </div>
    );
};
export default ProgressiveImg;