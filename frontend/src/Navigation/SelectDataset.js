import * as React from 'react';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import 'tailwindcss/tailwind.css'

function cleanText(text) {
    // Split text on underscore
    let split_text = text.split('_');
    // Create a new string with the first letter of each word capitalized
    let cleaned_text = '';
    for (let i = 0; i < split_text.length; i++) {
        cleaned_text += split_text[i].charAt(0).toUpperCase() + split_text[i].slice(1) + ' ';
    }
    // Remove last space
    cleaned_text = cleaned_text.slice(0, -1);
    return cleaned_text;
}

export default function SelectDataset(props) {
    console.log(props.datasets);
    const [dataset, setDataset] = React.useState(props.datasets[0]);

    const handleChange = (event) => {
        setDataset(event.target.value);
        // TODO: Send dataset choice to server.
    };

    return (
        <Select
                value={dataset}
                onChange={handleChange}
                className="w-selector h-searchbar bg-white font-bar"
            >
                {props.datasets.map((dataset) => (
                    <MenuItem key={dataset} value={dataset}>
                        {cleanText(dataset)}
                    </MenuItem>
                ))}
            </Select>
    );
}