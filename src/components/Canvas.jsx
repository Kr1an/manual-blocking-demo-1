import React, { useRef, useEffect, useState } from 'react';


const Canvas = () => {
    const canvasRef = useRef(null);
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [transformers, setTransformers] = useState([]);
    const isDraggingBackground = useRef(false);
    const draggingTransformerId = useRef(null);
    const clickStartPos = useRef({ x: 0, y: 0 });
    const lastMousePos = useRef({ x: 0, y: 0 });
    const allTrackersRef = useRef([]);
    const polygonRef = useRef([]);
    const roadsRef = useRef([
        { p1: { x: -1200, y: 0 }, p2: { x: 1200, y: 0 } },
        { p1: { x: 0, y: -1200 }, p2: { x: 0, y: 1200 } }
    ]);

    const ASPECT_RATIO = 1 / 7;
    const TRACKER_WIDTH = 12 / 1.7;
    const TRACKER_HEIGHT = TRACKER_WIDTH / ASPECT_RATIO;
    const TRANSFORMER_SIZE = 30;
    const GAP = 2;
    const ROAD_WIDTH = 25;

    const boundaryCoords = [
        [-72.4559521, 42.9074371], [-72.4559513, 42.9075], [-72.4508424, 42.9061169],
        [-72.449855, 42.9063684], [-72.4485241, 42.905834], [-72.4511859, 42.9040422],
        [-72.4515723, 42.9047966], [-72.4554361, 42.9056454], [-72.4568958, 42.9055196],
        [-72.4574539, 42.9039164], [-72.456767, 42.9015902], [-72.4541482, 42.9007414],
        [-72.4512288, 42.900207], [-72.4488247, 42.9002698], [-72.4478802, 42.9009929],
        [-72.4468498, 42.9005213], [-72.4445315, 42.9025647], [-72.4436728, 42.9042937],
        [-72.4398519, 42.9071542], [-72.4381776, 42.9073114], [-72.4374482, 42.9080029],
        [-72.4384352, 42.9085687], [-72.4384352, 42.9089459], [-72.4375336, 42.9089773],
        [-72.4357734, 42.9102346], [-72.4332404, 42.9100775], [-72.4332404, 42.9104861],
        [-72.4319525, 42.9104861], [-72.4298917, 42.9093545], [-72.4285608, 42.9095745],
        [-72.4258561, 42.9091345], [-72.4255556, 42.9097631], [-72.4285179, 42.9104861],
        [-72.4295912, 42.9125291], [-72.4313514, 42.9138178], [-72.4316949, 42.914635],
        [-72.4338415, 42.9148864], [-72.432897, 42.9161436], [-72.436031, 42.9176207],
        [-72.4374482, 42.9186264], [-72.4392509, 42.919915], [-72.4398956, 42.9206692],
        [-72.4405825, 42.921832], [-72.4422139, 42.9227119], [-72.444017, 42.923529],
        [-72.4457343, 42.9217691], [-72.445305, 42.9212977], [-72.4471081, 42.9162064],
        [-72.4487395, 42.9161122], [-72.4497269, 42.9147607], [-72.4520023, 42.9143207],
        [-72.4519165, 42.9138806], [-72.4525604, 42.9127491], [-72.4533761, 42.9123405],
        [-72.4539772, 42.9112404], [-72.454106, 42.9099832], [-72.4559521, 42.9074371]
    ];

    // Helpers
    const isPointInPolygon = (x, y, poly) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    const distToSegment = (p, v, w) => {
        const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
        if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
    };

    const doSegmentsIntersect = (p1, p2, p3, p4) => {
        const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
        if (det === 0) return false;
        const uA = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));
        const uB = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));
        return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
    };

    // Initialize polygon and trackers
    useEffect(() => {
        const minX = Math.min(...boundaryCoords.map(c => c[0]));
        const maxX = Math.max(...boundaryCoords.map(c => c[0]));
        const minY = Math.min(...boundaryCoords.map(c => c[1]));
        const maxY = Math.max(...boundaryCoords.map(c => c[1]));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const scale = 60000;

        polygonRef.current = boundaryCoords.map(c => ({
            x: (c[0] - centerX) * scale,
            y: (centerY - c[1]) * scale
        }));

        const generateTrackers = () => {
            const newTrackers = [];
            const bbMinX = Math.min(...polygonRef.current.map(p => p.x));
            const bbMaxX = Math.max(...polygonRef.current.map(p => p.x));
            const bbMinY = Math.min(...polygonRef.current.map(p => p.y));
            const bbMaxY = Math.max(...polygonRef.current.map(p => p.y));

            const STEP_X = TRACKER_WIDTH + GAP;
            const STEP_Y = TRACKER_HEIGHT + GAP;

            for (let y = bbMinY; y <= bbMaxY - TRACKER_HEIGHT; y += STEP_Y) {
                for (let x = bbMinX; x <= bbMaxX - TRACKER_WIDTH; x += STEP_X) {
                    const newTracker = { x, y, width: TRACKER_WIDTH, height: TRACKER_HEIGHT };
                    const corners = [
                        { x: newTracker.x, y: newTracker.y },
                        { x: newTracker.x + newTracker.width, y: newTracker.y },
                        { x: newTracker.x + newTracker.width, y: newTracker.y + newTracker.height },
                        { x: newTracker.x, y: newTracker.y + newTracker.height }
                    ];

                    if (corners.every(c => isPointInPolygon(c.x, c.y, polygonRef.current))) {
                        const trackerEdges = [
                            [corners[0], corners[1]], [corners[1], corners[2]],
                            [corners[2], corners[3]], [corners[3], corners[0]]
                        ];

                        let hasIntersection = false;
                        for (let i = 0; i < polygonRef.current.length; i++) {
                            const p1 = polygonRef.current[i];
                            const p2 = polygonRef.current[(i + 1) % polygonRef.current.length];
                            for (const tEdge of trackerEdges) {
                                if (doSegmentsIntersect(p1, p2, tEdge[0], tEdge[1])) {
                                    hasIntersection = true; break;
                                }
                            }
                            if (hasIntersection) break;
                        }

                        if (hasIntersection) continue;

                        let onRoad = false;
                        for (const road of roadsRef.current) {
                            for (const tEdge of trackerEdges) {
                                if (doSegmentsIntersect(road.p1, road.p2, tEdge[0], tEdge[1])) {
                                    onRoad = true; break;
                                }
                            }
                            if (onRoad) break;

                            for (const corner of corners) {
                                if (distToSegment(corner, road.p1, road.p2) < ROAD_WIDTH / 2) {
                                    onRoad = true; break;
                                }
                            }
                            if (onRoad) break;
                        }

                        if (!onRoad) newTrackers.push(newTracker);
                    }
                }
            }
            return newTrackers;
        };

        allTrackersRef.current = generateTrackers();
    }, []);

    const [selectedTfId, setSelectedTfId] = useState(null);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const [skipRemoveConfirm, setSkipRemoveConfirm] = useState(() => localStorage.getItem('skipRemoveConfirm') === 'true');
    const [debouncedTransformers, setDebouncedTransformers] = useState([]);

    useEffect(() => {
        localStorage.setItem('skipRemoveConfirm', skipRemoveConfirm);
    }, [skipRemoveConfirm]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT') return;

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTfId) {
                if (skipRemoveConfirm) {
                    const idToRemove = selectedTfId;
                    setSelectedTfId(null);
                    setTransformers(prev => prev.filter(tf => tf.id !== idToRemove));
                } else {
                    setShowRemoveConfirm(true);
                }
            } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedTfId) {
                const step = e.key === 'ArrowLeft' ? -1 : 1;
                if (e.ctrlKey) {
                    setTransformers(prev => prev.map(tf => {
                        if (tf.id === selectedTfId) {
                            const newVal = Math.max(1, Math.min(tf.blockWidthUnits + step, 40));
                            return { ...tf, blockWidthUnits: newVal };
                        }
                        return tf;
                    }));
                } else if (e.shiftKey) {
                    setTransformers(prev => prev.map(tf =>
                        tf.id === selectedTfId ? { ...tf, x: tf.x + (step * 5) } : tf
                    ));
                } else {
                    setTransformers(prev => prev.map(tf =>
                        tf.id === selectedTfId ? { ...tf, hNudge: tf.hNudge + step } : tf
                    ));
                }
            } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && selectedTfId) {
                if (e.ctrlKey) {
                    const step = e.key === 'ArrowUp' ? 1 : -1;
                    setTransformers(prev => prev.map(tf => {
                        if (tf.id === selectedTfId) {
                            const newVal = Math.max(1, Math.min(tf.blockHeightUnits + step, 40));
                            return { ...tf, blockHeightUnits: newVal };
                        }
                        return tf;
                    }));
                } else if (e.shiftKey) {
                    const step = e.key === 'ArrowUp' ? -5 : 5;
                    setTransformers(prev => prev.map(tf =>
                        tf.id === selectedTfId ? { ...tf, y: tf.y + step } : tf
                    ));
                } else {
                    const step = e.key === 'ArrowUp' ? -1 : 1;
                    setTransformers(prev => prev.map(tf =>
                        tf.id === selectedTfId ? { ...tf, vNudge: tf.vNudge + step } : tf
                    ));
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                if (transformers.length === 0) return;
                const currentIndex = transformers.findIndex(tf => tf.id === selectedTfId);
                let nextIndex;
                if (e.shiftKey) {
                    nextIndex = (currentIndex <= 0) ? transformers.length - 1 : currentIndex - 1;
                } else {
                    nextIndex = (currentIndex === -1 || currentIndex === transformers.length - 1) ? 0 : currentIndex + 1;
                }
                setSelectedTfId(transformers[nextIndex].id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedTfId, skipRemoveConfirm, transformers]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedTransformers(transformers);
        }, 500);
        return () => clearTimeout(timer);
    }, [transformers]);

    // Calculate transformer counts for the UI using live state for instant feedback
    const transformerCounts = {};
    transformers.forEach(tf => transformerCounts[tf.id] = 0);

    // We do a temporary pass to calculate counts for the UI rendering using live state
    allTrackersRef.current.forEach(tracker => {
        const rCenterX = tracker.x + tracker.width / 2;
        const rCenterY = tracker.y + tracker.height / 2;
        const rX1 = tracker.x, rY1 = tracker.y;
        const rX2 = tracker.x + tracker.width, rY2 = tracker.y + tracker.height;

        const isBlocked = transformers.some(tf => {
            const tfX1 = tf.x - TRANSFORMER_SIZE / 2, tfY1 = tf.y - TRANSFORMER_SIZE / 2;
            const tfX2 = tf.x + TRANSFORMER_SIZE / 2, tfY2 = tf.y + TRANSFORMER_SIZE / 2;
            return !(rX2 < tfX1 || rX1 > tfX2 || rY2 < tfY1 || rY1 > tfY2);
        });
        if (isBlocked) return;

        const assignedTf = transformers.find(tf => {
            const fullW = tf.blockWidthUnits * (TRACKER_WIDTH + GAP);
            const fullH = tf.blockHeightUnits * (TRACKER_HEIGHT + GAP);
            const bX1 = tf.x - fullW / 2 + (tf.hNudge * (TRACKER_WIDTH + GAP));
            const bY1 = tf.y - fullH / 2 + (tf.vNudge * (TRACKER_HEIGHT + GAP));
            return rCenterX >= bX1 && rCenterX <= bX1 + fullW &&
                rCenterY >= bY1 && rCenterY <= bY1 + fullH;
        });
        if (assignedTf) transformerCounts[assignedTf.id]++;
    });

    // Render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
            ctx.scale(transform.scale, transform.scale);

            // 1. Draw Roads
            ctx.strokeStyle = 'brown';
            ctx.lineWidth = 25;
            roadsRef.current.forEach(road => {
                ctx.beginPath();
                ctx.moveTo(road.p1.x, road.p1.y);
                ctx.lineTo(road.p2.x, road.p2.y);
                ctx.stroke();
            });

            // 2. Draw Boundary lines
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 5 / transform.scale;
            ctx.beginPath();
            polygonRef.current.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.closePath();
            ctx.stroke();

            // 3. Draw Trackers (compute filtered and assigned trackers)
            allTrackersRef.current.forEach((tracker) => {
                const rX1 = tracker.x;
                const rY1 = tracker.y;
                const rX2 = tracker.x + tracker.width;
                const rY2 = tracker.y + tracker.height;
                const rCenterX = tracker.x + tracker.width / 2;
                const rCenterY = tracker.y + tracker.height / 2;

                // Check if blocked (hidden by transformer footprint)
                const isBlocked = transformers.some(tf => {
                    const tfX1 = tf.x - TRANSFORMER_SIZE / 2;
                    const tfY1 = tf.y - TRANSFORMER_SIZE / 2;
                    const tfX2 = tf.x + TRANSFORMER_SIZE / 2;
                    const tfY2 = tf.y + TRANSFORMER_SIZE / 2;
                    return !(rX2 < tfX1 || rX1 > tfX2 || rY2 < tfY1 || rY1 > tfY2);
                });

                if (isBlocked) return;

                // Find block assignment
                const assignedTf = transformers.find(tf => {
                    const fullW = tf.blockWidthUnits * (TRACKER_WIDTH + GAP);
                    const fullH = tf.blockHeightUnits * (TRACKER_HEIGHT + GAP);
                    const bX1 = tf.x - fullW / 2 + (tf.hNudge * (TRACKER_WIDTH + GAP));
                    const bY1 = tf.y - fullH / 2 + (tf.vNudge * (TRACKER_HEIGHT + GAP));
                    return rCenterX >= bX1 && rCenterX <= bX1 + fullW &&
                        rCenterY >= bY1 && rCenterY <= bY1 + fullH;
                });

                if (assignedTf) {
                    ctx.fillStyle = assignedTf.color;
                    ctx.globalAlpha = 0.4;
                    ctx.fillRect(tracker.x, tracker.y, tracker.width, tracker.height);
                    ctx.globalAlpha = 1.0;
                    ctx.strokeStyle = assignedTf.strokeColor;
                } else {
                    ctx.strokeStyle = 'black';
                }

                ctx.lineWidth = 1.5 / transform.scale;
                ctx.strokeRect(tracker.x, tracker.y, tracker.width, tracker.height);
            });

            // 4. Draw Transformers
            transformers.forEach(tf => {
                ctx.fillStyle = tf.color;
                ctx.fillRect(tf.x - TRANSFORMER_SIZE / 2, tf.y - TRANSFORMER_SIZE / 2, TRANSFORMER_SIZE, TRANSFORMER_SIZE);
                ctx.strokeStyle = tf.strokeColor;
                ctx.lineWidth = 2 / transform.scale;
                ctx.strokeRect(tf.x - TRANSFORMER_SIZE / 2, tf.y - TRANSFORMER_SIZE / 2, TRANSFORMER_SIZE, TRANSFORMER_SIZE);

                // Draw label
                const count = transformerCounts[tf.id] || 0;
                ctx.fillStyle = 'white';
                const fontSize = 14 / transform.scale;
                ctx.font = `bold ${fontSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.fillText(count.toString(), tf.x, tf.y);
                ctx.shadowBlur = 0;
            });

            // 5. Draw bounding box for selected transformer
            if (selectedTfId) {
                const tf = transformers.find(t => t.id === selectedTfId);
                if (tf) {
                    const fullW = tf.blockWidthUnits * (TRACKER_WIDTH + GAP);
                    const fullH = tf.blockHeightUnits * (TRACKER_HEIGHT + GAP);
                    const bX1 = tf.x - fullW / 2 + (tf.hNudge * (TRACKER_WIDTH + GAP));
                    const bY1 = tf.y - fullH / 2 + (tf.vNudge * (TRACKER_HEIGHT + GAP));

                    ctx.strokeStyle = tf.strokeColor;
                    ctx.setLineDash([8 / transform.scale, 4 / transform.scale]);
                    ctx.lineWidth = 2 / transform.scale;
                    ctx.strokeRect(bX1, bY1, fullW, fullH);
                    ctx.setLineDash([]);

                    // Optional: subtle fill to make the area more obvious
                    ctx.fillStyle = tf.color;
                    ctx.globalAlpha = 0.05;
                    ctx.fillRect(bX1, bY1, fullW, fullH);
                    ctx.globalAlpha = 1.0;
                }
            }
        };

        const handleResize = () => {
            const { clientWidth, clientHeight } = canvas.parentElement;
            canvas.width = clientWidth;
            canvas.height = clientHeight;
            draw();
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [transform, transformers, selectedTfId]);

    const handleWheel = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const zoomSpeed = 0.005;
        const factor = Math.pow(1.1, -e.deltaY * zoomSpeed);
        const newScale = Math.max(0.1, Math.min(transform.scale * factor, 20));
        const zoomFactor = newScale / transform.scale;
        const mouseX = e.clientX - canvas.width / 2;
        const mouseY = e.clientY - canvas.height / 2;
        setTransform(prev => ({
            scale: newScale,
            x: mouseX - (mouseX - prev.x) * zoomFactor,
            y: mouseY - (mouseY - prev.y) * zoomFactor
        }));
    };

    const handleMouseDown = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - (canvas.width / 2 + transform.x)) / transform.scale;
        const worldY = (mouseY - (canvas.height / 2 + transform.y)) / transform.scale;

        const clickedTransformer = transformers.find(tf => {
            const tfX1 = tf.x - TRANSFORMER_SIZE / 2;
            const tfY1 = tf.y - TRANSFORMER_SIZE / 2;
            const tfX2 = tf.x + TRANSFORMER_SIZE / 2;
            const tfY2 = tf.y + TRANSFORMER_SIZE / 2;
            return worldX >= tfX1 && worldX <= tfX2 && worldY >= tfY1 && worldY <= tfY2;
        });

        if (clickedTransformer) {
            draggingTransformerId.current = clickedTransformer.id;
            setSelectedTfId(clickedTransformer.id);
        } else {
            // Check if click is inside any block's bounding box (including gaps between trackers)
            let targetTf = debouncedTransformers.find(tf => {
                const fullW = tf.blockWidthUnits * (TRACKER_WIDTH + GAP);
                const fullH = tf.blockHeightUnits * (TRACKER_HEIGHT + GAP);
                const bX1 = tf.x - fullW / 2 + (tf.hNudge * (TRACKER_WIDTH + GAP));
                const bY1 = tf.y - fullH / 2 + (tf.vNudge * (TRACKER_HEIGHT + GAP));
                return worldX >= bX1 && worldX <= bX1 + fullW &&
                    worldY >= bY1 && worldY <= bY1 + fullH;
            });

            // If not in a block bounds, check if click is on a tracker physically coverered by a device
            if (!targetTf) {
                const hitTracker = allTrackersRef.current.find(tr =>
                    worldX >= tr.x && worldX <= tr.x + tr.width &&
                    worldY >= tr.y && worldY <= tr.y + tr.height
                );

                if (hitTracker) {
                    targetTf = transformers.find(tf => {
                        const tfX1 = tf.x - TRANSFORMER_SIZE / 2, tfY1 = tf.y - TRANSFORMER_SIZE / 2;
                        const tfX2 = tf.x + TRANSFORMER_SIZE / 2, tfY2 = tf.y + TRANSFORMER_SIZE / 2;
                        const trX2 = hitTracker.x + hitTracker.width, trY2 = hitTracker.y + hitTracker.height;
                        return !(trX2 < tfX1 || hitTracker.x > tfX2 || trY2 < tfY1 || hitTracker.y > tfY2);
                    });
                }
            }

            if (targetTf) {
                setSelectedTfId(targetTf.id);
            } else {
                isDraggingBackground.current = true;
            }
        }

        clickStartPos.current = { x: e.clientX, y: e.clientY };
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e) => {
        const wasDraggingTf = draggingTransformerId.current !== null;

        if (!wasDraggingTf && isDraggingBackground.current) {
            const dx = e.clientX - clickStartPos.current.x;
            const dy = e.clientY - clickStartPos.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 5) {
                setSelectedTfId(null);
                const canvas = canvasRef.current;
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    const worldX = (mouseX - (canvas.width / 2 + transform.x)) / transform.scale;
                    const worldY = (mouseY - (canvas.height / 2 + transform.y)) / transform.scale;

                    const hue = (transformers.length * 137.5) % 360;
                    const color = `hsla(${hue}, 70%, 50%, 0.7)`;
                    const strokeColor = `hsl(${hue}, 70%, 30%)`;

                    const newId = Date.now();
                    const newTf = {
                        id: newId,
                        x: worldX,
                        y: worldY,
                        color,
                        strokeColor,
                        blockWidthUnits: 25,
                        blockHeightUnits: 4,
                        hNudge: 0,
                        vNudge: 0
                    };
                    setTransformers(prev => [...prev, newTf]);
                    setSelectedTfId(newId);
                }
            }
        }

        isDraggingBackground.current = false;
        draggingTransformerId.current = null;
    };

    const handleMouseMove = (e) => {
        const screenDx = e.clientX - lastMousePos.current.x;
        const screenDy = e.clientY - lastMousePos.current.y;
        const worldDx = screenDx / transform.scale;
        const worldDy = screenDy / transform.scale;

        if (draggingTransformerId.current) {
            setTransformers(prev => prev.map(tf =>
                tf.id === draggingTransformerId.current
                    ? { ...tf, x: tf.x + worldDx, y: tf.y + worldDy }
                    : tf
            ));
        } else if (isDraggingBackground.current) {
            setTransform(prev => ({
                ...prev,
                x: prev.x + screenDx,
                y: prev.y + screenDy
            }));
        }
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const getCursorStyle = () => {
        if (draggingTransformerId.current || isDraggingBackground.current) return 'grabbing';
        return 'grab';
    };

    const selectedTf = transformers.find(tf => tf.id === selectedTfId);

    return (
        <div
            className="canvas-container"
            style={{ width: '100%', height: '100vh', overflow: 'hidden', cursor: getCursorStyle(), position: 'relative' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            <canvas ref={canvasRef} style={{ display: 'block' }} />

            {selectedTf && (
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute', top: '20px', right: '20px', width: 'max-content', minWidth: '220px',
                        backgroundColor: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)',
                        borderRadius: '16px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                        padding: '16px', border: '1px solid rgba(255, 255, 255, 0.3)',
                        fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a1a1a',
                        zIndex: 1000, animation: 'slideIn 0.3s ease-out',
                        display: 'flex', flexDirection: 'column', gap: '12px',
                        whiteSpace: 'nowrap'
                    }}>
                    <style>{`
                        @keyframes slideIn {
                            from { transform: translateX(100%); opacity: 0; }
                            to { transform: translateX(0); opacity: 1; }
                        }
                    `}</style>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '16px', height: '16px', backgroundColor: selectedTf.color, borderRadius: '4px', border: `1px solid ${selectedTf.strokeColor}` }} />
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                {(() => {
                                    const hueMatch = selectedTf.color.match(/hsla?\((\d+)/);
                                    const hue = hueMatch ? parseInt(hueMatch[1]) : 0;
                                    if (hue >= 330 || hue < 20) return 'Red';
                                    if (hue >= 20 && hue < 50) return 'Orange';
                                    if (hue >= 50 && hue < 80) return 'Yellow';
                                    if (hue >= 80 && hue < 160) return 'Green';
                                    if (hue >= 160 && hue < 200) return 'Cyan';
                                    if (hue >= 200 && hue < 260) return 'Blue';
                                    if (hue >= 260 && hue < 330) return 'Purple';
                                })()} Block <span style={{ color: '#d97706', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>(Tab / Shift+Tab)</span>
                            </span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedTfId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#666' }}>&times;</button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                        <span style={{ color: '#666' }}>Trackers:</span>
                        <span style={{ fontWeight: 700 }}>{transformerCounts[selectedTf.id] || 0}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#333', letterSpacing: '0.05em' }}>BLOCK SETTINGS</label>


                        {(() => {
                            const dbTf = debouncedTransformers.find(tf => tf.id === selectedTfId) || selectedTf;
                            return (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999', fontWeight: 700 }}>
                                                Horizontal Pinning <span style={{ color: '#d97706' }}>(<span style={{ fontSize: '0.7rem', fontWeight: 800 }}>◀</span> / <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>▶</span>)</span>
                                            </label>
                                        </div>
                                        <input
                                            type="range"
                                            min={-Math.floor(dbTf.blockWidthUnits / 2) - 10}
                                            max={Math.ceil(dbTf.blockWidthUnits / 2) + 10}
                                            value={selectedTf.hNudge}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                setTransformers(prev => prev.map(tf => tf.id === selectedTfId ? { ...tf, hNudge: val } : tf));
                                            }}
                                            style={{ width: '100%', cursor: 'pointer', accentColor: '#1a1a1a' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999', fontWeight: 700 }}>
                                                Vertical Pinning <span style={{ color: '#d97706' }}>(<span style={{ fontSize: '0.85rem', fontWeight: 800 }}>▲</span> / <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>▼</span>)</span>
                                            </label>
                                        </div>
                                        <input
                                            type="range"
                                            min={-Math.floor(dbTf.blockHeightUnits / 2) - 1}
                                            max={Math.ceil(dbTf.blockHeightUnits / 2) + 1}
                                            value={selectedTf.vNudge}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                setTransformers(prev => prev.map(tf => tf.id === selectedTfId ? { ...tf, vNudge: val } : tf));
                                            }}
                                            style={{ width: '100%', cursor: 'pointer', accentColor: '#1a1a1a' }}
                                        />
                                    </div>
                                </>
                            );
                        })()}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999', fontWeight: 700 }}>
                                    Width <span style={{ color: '#d97706' }}>(Ctrl + <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>◀</span> / <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>▶</span>)</span>
                                </label>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1a1a1a' }}>{selectedTf.blockWidthUnits}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="40"
                                value={selectedTf.blockWidthUnits}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    setTransformers(prev => prev.map(tf => tf.id === selectedTfId ? { ...tf, blockWidthUnits: val } : tf));
                                }}
                                style={{ width: '100%', cursor: 'pointer', accentColor: '#1a1a1a' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999', fontWeight: 700 }}>
                                    Height <span style={{ color: '#d97706' }}>(Ctrl + <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>▲</span> / <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>▼</span>)</span>
                                </label>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1a1a1a' }}>{selectedTf.blockHeightUnits}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="20"
                                value={selectedTf.blockHeightUnits}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    setTransformers(prev => prev.map(tf => tf.id === selectedTfId ? { ...tf, blockHeightUnits: val } : tf));
                                }}
                                style={{ width: '100%', cursor: 'pointer', accentColor: '#1a1a1a' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999', fontWeight: 700 }}>
                                Transformer Position <span style={{ color: '#d97706' }}>(Shift + <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>◀</span> / <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>▶</span> / <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>▲</span> / <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>▼</span>)</span>
                            </label>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #fee2e2', paddingTop: '12px', marginTop: '4px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#991b1b', letterSpacing: '0.05em' }}>DANGER ZONE</label>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (skipRemoveConfirm) {
                                    const idToRemove = selectedTfId;
                                    setSelectedTfId(null);
                                    setTransformers(prev => prev.filter(tf => tf.id !== idToRemove));
                                } else {
                                    setShowRemoveConfirm(true);
                                }
                            }}
                            style={{
                                width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #fecaca',
                                backgroundColor: '#fef2f2', color: '#991b1b', fontWeight: 600, fontSize: '0.8rem',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                        >
                            Remove Block <span style={{ color: '#f87171', opacity: 0.8 }}>(Del)</span>
                        </button>
                    </div>
                </div>
            )}

            {showRemoveConfirm && (
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                    }}
                >
                    <div style={{
                        width: '320px', backgroundColor: 'white', borderRadius: '20px', padding: '24px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid rgba(0,0,0,0.05)',
                        animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                        <style>{`
                            @keyframes popIn {
                                from { transform: scale(0.9); opacity: 0; }
                                to { transform: scale(1); opacity: 1; }
                            }
                        `}</style>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: '#1a1a1a', fontWeight: 700 }}>Remove Block?</h3>
                        <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: '#666', lineHeight: '1.5' }}>
                            Are you sure you want to remove this transformer block? This action cannot be undone.
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', cursor: 'pointer' }} onClick={() => setSkipRemoveConfirm(!skipRemoveConfirm)}>
                            <input
                                type="checkbox"
                                checked={skipRemoveConfirm}
                                onChange={(e) => { }} // State handled by parent div onClick
                                onClick={(e) => e.stopPropagation()}
                                style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.8rem', color: '#666', userSelect: 'none' }}>Don't ask me again</span>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowRemoveConfirm(false)}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #ddd',
                                    backgroundColor: 'white', color: '#666', fontWeight: 600, cursor: 'pointer'
                                }}
                            >Cancel</button>
                            <button
                                onClick={() => {
                                    const idToRemove = selectedTfId;
                                    setSelectedTfId(null);
                                    setTransformers(prev => prev.filter(tf => tf.id !== idToRemove));
                                    setShowRemoveConfirm(false);
                                }}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                                    backgroundColor: '#991b1b', color: 'white', fontWeight: 600, cursor: 'pointer'
                                }}
                            >Remove</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Canvas;
