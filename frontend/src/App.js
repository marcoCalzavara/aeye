import React from "react";
import StickyBar from "./Navigation/StickyBar";
import Grid from "./Grid/Grid";

function App() {
    const [image, setImage] = React.useState(null);

    const updateImage = (image) => {
        setImage(image);
    }

    return (
        <div className="flex justify-center">
            {/*<StickyBar onImageFetched={updateImage}/>*/}
            <Grid/>
        </div>
    );
}

export default App;
