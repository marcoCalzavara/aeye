import React from "react";
import './App.css';
import StickyBar from "./Navigation/StickyBar";
import image from "./assets/clip.webp"

function App() {
    return (
        <div className="App">
            <StickyBar/>
            <div className="title-container">
                <img src={image} alt="Image" className="image"/>
                <h1 className="title">
                    AI Plus Art: A Visualization Tool
                </h1>
            </div>
        </div>
    );
}

export default App;
