
export const parseDxf = (dxfContent) => {
    const lines = dxfContent.split(/\r\n|\n/);
    let i = 0;

    const nextValue = () => lines[i++].trim();
    const nextCode = () => parseInt(nextValue());

    const extractCoords = (startIndex, count) => {
        const coords = [];
        for (let k = 0; k < count; k++) {
            let x, y, z;
            while (nextCode() !== 10) {} // Find X coordinate
            x = parseFloat(nextValue());
            while (nextCode() !== 20) {} // Find Y coordinate
            y = parseFloat(nextValue());
            while (lines[i].trim() !== '0' && nextCode() !== 30) {} // Find Z coordinate (optional, or next entity)
            if (parseInt(lines[i-1].trim()) === 30) {
                z = parseFloat(nextValue());
            } else {
                z = 0; // Default Z to 0 if not found
            }
            coords.push([x, y, z]);
        }
        return coords;
    };

    const boundary = [];
    const roads = [];

    while (i < lines.length) {
        const code = nextCode();
        const value = nextValue();

        if (code === 0 && value === 'SECTION') {
            if (nextValue() === 'ENTITIES') {
                while (i < lines.length) {
                    const entityCode = nextCode();
                    const entityType = nextValue();

                    if (entityType === 'ENDSEC') break;

                    if (entityType === 'LWPOLYLINE') {
                        let layer = '';
                        let vertexCount = 0;
                        const currentPolylineCoords = [];

                        while (nextCode() !== 0) {
                            const groupCode = parseInt(lines[i - 1].trim());
                            const groupValue = lines[i].trim();

                            if (groupCode === 8) { // Layer name
                                layer = groupValue;
                            } else if (groupCode === 90) { // Number of vertices
                                vertexCount = parseInt(groupValue);
                            } else if (groupCode === 10) { // X coordinate
                                const x = parseFloat(groupValue);
                                nextCode(); // 20
                                const y = parseFloat(nextValue());
                                // Check for 30 (Z coordinate), if not 0 (next entity)
                                if (parseInt(lines[i].trim()) === 30) {
                                    nextValue(); // 30
                                    parseFloat(nextValue()); // Z value
                                } else {
                                    // If not 30, it could be the next entity's group code. Backtrack 'i' to re-process.
                                    // This is a simplification; a full DXF parser would handle this more robustly.
                                    // For now, assuming 10 is followed by 20 and then 0 or 30.
                                }
                                currentPolylineCoords.push([x, y]);
                            }
                            i++;
                        }

                        // After loop, 'i' is at the start of next entity or ENDSEC
                        i--; // Decrement to re-read the '0' code for next entity or ENDSEC

                        if (layer === 'pvfarm_boundary_include') {
                            boundary.push(...currentPolylineCoords);
                        } else if (layer === 'pvfarm_road_20.000ft') {
                            // For roads, we need to extract the segments
                            for (let k = 0; k < currentPolylineCoords.length - 1; k++) {
                                roads.push({
                                    p1: { x: currentPolylineCoords[k][0], y: currentPolylineCoords[k][1] },
                                    p2: { x: currentPolylineCoords[k + 1][0], y: currentPolylineCoords[k + 1][1] }
                                });
                            }
                        }
                    }
                }
            }
        }
        i++;
    }
    return { boundary, roads };
};
