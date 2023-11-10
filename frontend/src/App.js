import React from "react";
import StickyBar from "./Navigation/StickyBar";

function App() {
    const [image, setImage] = React.useState(null);

    const updateImage = (image) => {
        setImage(image);
    }

    return (
        <div className="w-screen h-screen overflow-x-auto flex">
            <StickyBar onImageFetched={updateImage}/>
        </div>
    );
}

export default App;
