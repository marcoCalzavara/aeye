import * as React from 'react';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import "SelectDataset.css"


export default function SelectDataset() {
    const [dataset, setDataset] = React.useState("Dataset1");

    const handleChange = (event) => {
        setDataset(event.target.value);
        // TODO: Send dataset choice to server.
    };

    return (
        <div className="select-dataset">
            <FormControl className="form-control">
                <Select
                    value={dataset}
                    onChange={handleChange}
                    sx={{height: "100%", backgroundColor: "white"}}
                >
                    <MenuItem value={"Dataset1"}>Dataset1</MenuItem>
                    <MenuItem value={"Dataset2"}>Dataset2</MenuItem>
                    <MenuItem value={"Dataset3"}>Dataset3</MenuItem>
                </Select>
            </FormControl>
        </div>
    );
}