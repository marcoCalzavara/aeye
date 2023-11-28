import React from "react";
import StickyBar from "./Navigation/StickyBar";
import Grid from "./Grid/Grid_v2";

function App() {
    const [image, setImage] = React.useState(null);

    const updateImage = (image) => {
        setImage(image);
    }

    return (
        <div className="flex justify-center">
            {/*<StickyBar onImageFetched={updateImage}/>*/}
            <Grid ></Grid>
        </div>
    );
}

export default App;
