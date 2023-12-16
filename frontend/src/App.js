import React, {useEffect, useState} from 'react';
import ClustersMap from "./Map/ClustersMap";
import {Stage} from "@pixi/react";
import StickyBar from "./Navigation/StickyBar";
import SearchBar from "./Navigation/SearchBar";
import Switch from '@mui/material/Switch';
import { FormControlLabel} from "@mui/material";
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
    components: {
        MuiSwitch: {
            styleOverrides: {
                track: {
                    // Controls default (unchecked) color for the track
                    opacity: 0.2,
                    backgroundColor: "#fff",
                    ".Mui-checked.Mui-checked + &": {
                        // Controls checked color for the track
                        opacity: 0.7,
                        backgroundColor: "#fff"
                    }
                }
            }
        }
    }
});

function App() {
    const [dimensionsStage, setDimensionsStage] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });
    const [showBar, setShowBar] = useState(false);
    // Define data from text search
    const [searchData, setSearchData] = useState({});

    useEffect(() => {
        const handleResizeStage = () => {
            setDimensionsStage({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };

        // Add event listener
        window.addEventListener('resize', handleResizeStage);

        // Return cleanup function
        return () => {
            window.removeEventListener('resize', handleResizeStage);
        };
    }, []);

    return (
        <div id="main">
            <div className={`fixed top-0 right-0 z-50 m-2 ${showBar ? 'bg-zinc-950' : 'bg-black'}`}>
                <ThemeProvider theme={theme}>
                    <FormControlLabel className="text-white"
                        control={
                        <Switch checked={!showBar}
                                onChange={() => setShowBar(!showBar)}
                                track={{color: 'white'}}
                        />
                    } label="Hide" />
                </ThemeProvider>
            </div>
            {showBar && <StickyBar/>}
            {showBar && <div className="2xl:mt-16 xl:mt-14 md:mt-14 sm:mt-12 xs:mt-12">
                <SearchBar host="http://localhost:80" setSearchData={setSearchData}/>
            </div>}
            <div className="bg-zinc-900 flex flex-col items-center">
                <Stage width={dimensionsStage.width}
                       height={dimensionsStage.height}
                       raf={true}
                       renderOnComponentChange={false}
                       options={{backgroundColor: 0x000000}}>
                    <ClustersMap width={dimensionsStage.width} height={dimensionsStage.height}
                                 host="http://localhost:80" searchData={searchData}/>
                </Stage>
            </div>
        </div>
    );
}


export default App;
