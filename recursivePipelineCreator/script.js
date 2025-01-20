let unitCounter = 1;
let connections = [];
let activeConnection = null;
let movingConnection = null;

document.querySelectorAll('.unit-btn').forEach(button => {
    button.addEventListener('click', () => createUnit(button.dataset.type));
});

document.getElementById('runPipeline').addEventListener('click', runPipeline);

// Add mouse move listener for drawing active connection
document.addEventListener('mousemove', (e) => {
    if (activeConnection) {
        updateMovingConnection(e.clientX, e.clientY);
    }
});

// Add mouse up listener to cancel connection if clicked outside
document.addEventListener('mouseup', (e) => {
    if (activeConnection && !e.target.classList.contains('input-connector')) {
        removeMovingConnection();
    }
});

function createUnit(type) {
    const unit = document.createElement('div');
    unit.className = 'unit';
    unit.dataset.unitId = unitCounter;
    unit.style.left = `${50 + (unitCounter * 20)}px`;
    unit.style.top = `${100 + (unitCounter * 20)}px`;

    unit.innerHTML = `
        <div class="unit-header">
            <div class="connector input-connector" data-unit="${unitCounter}"></div>
            <span>${type.toUpperCase()} ${unitCounter}</span>
            <div class="connector output-connector" data-unit="${unitCounter}"></div>
            <span class="delete-btn">×</span>
        </div>
        <textarea class="textarea" placeholder="${type} processing..."></textarea>
    `;

    document.getElementById('workspace').appendChild(unit);
    
    initializeDragAndDrop(unit);
    initializeConnectors(unit);
    initializeDelete(unit);
    
    unitCounter++;
}

function initializeDragAndDrop(unit) {
    unit.querySelector('.unit-header').addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('connector') || e.target.classList.contains('delete-btn')) return;
        
        const rect = unit.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        function moveUnit(e) {
            unit.style.left = `${e.clientX - offsetX}px`;
            unit.style.top = `${e.clientY - offsetY}px`;
            updateConnections();
        }

        function stopDragging() {
            document.removeEventListener('mousemove', moveUnit);
            document.removeEventListener('mouseup', stopDragging);
        }

        document.addEventListener('mousemove', moveUnit);
        document.addEventListener('mouseup', stopDragging);
    });
}

function initializeConnectors(unit) {
    const outputConnector = unit.querySelector('.output-connector');
    const inputConnector = unit.querySelector('.input-connector');

    outputConnector.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        activeConnection = {
            fromUnit: unit.dataset.unitId,
            fromConnector: outputConnector
        };
        createMovingConnection(e.clientX, e.clientY);
    });

    inputConnector.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        if (activeConnection) {
            const fromUnitId = activeConnection.fromUnit;
            const toUnitId = unit.dataset.unitId;
            
            if (fromUnitId !== toUnitId) {
                createConnection(fromUnitId, toUnitId);
            }
            removeMovingConnection();
        }
    });
}

function createMovingConnection(startX, startY) {
    movingConnection = document.createElement('div');
    movingConnection.className = 'connection-line moving';
    document.getElementById('workspace').appendChild(movingConnection);
    updateMovingConnection(startX, startY);
}

function updateMovingConnection(mouseX, mouseY) {
    if (!activeConnection || !movingConnection) return;

    const fromRect = activeConnection.fromConnector.getBoundingClientRect();
    const fromX = fromRect.left + (fromRect.width / 2);
    const fromY = fromRect.top + (fromRect.height / 2);

    // Calculate length and angle from center of output connector to mouse
    const length = Math.sqrt(Math.pow(mouseX - fromX, 2) + Math.pow(mouseY - fromY, 2));
    const angle = Math.atan2(mouseY - fromY, mouseX - fromX);

    // Position and rotate the line
    movingConnection.style.width = `${length}px`;
    movingConnection.style.left = `${fromX}px`;
    movingConnection.style.top = `${fromY}px`;
    movingConnection.style.transform = `rotate(${angle}rad)`;
}


function removeMovingConnection() {
    if (movingConnection) {
        movingConnection.remove();
        movingConnection = null;
    }
    activeConnection = null;
}

function createConnection(fromUnitId, toUnitId) {
    // Remove any existing connections to the target input
    
    connections.push({ from: fromUnitId, to: toUnitId });
    updateConnections();
}

function updateConnections() {
    const existingLines = document.querySelectorAll('.connection-line:not(.moving)');
    existingLines.forEach(line => line.remove());

    connections.forEach(connection => {
        drawConnection(connection);
    });
}


function drawConnection(connection) {
    const fromUnit = document.querySelector(`[data-unit-id="${connection.from}"]`);
    const toUnit = document.querySelector(`[data-unit-id="${connection.to}"]`);
    
    if (!fromUnit || !toUnit) return;

    const fromConnector = fromUnit.querySelector('.output-connector');
    const toConnector = toUnit.querySelector('.input-connector');
    
    const fromRect = fromConnector.getBoundingClientRect();
    const toRect = toConnector.getBoundingClientRect();

    // Calculate positions from center of connectors
    const fromX = fromRect.left + (fromRect.width / 2);
    const fromY = fromRect.top + (fromRect.height / 2);
    const toX = toRect.left + (toRect.width / 2);
    const toY = toRect.top + (toRect.height / 2);

    const line = document.createElement('div');
    line.className = 'connection-line';
    line.dataset.from = connection.from;
    line.dataset.to = connection.to;
    document.getElementById('workspace').appendChild(line);

    // Calculate length and angle between connector centers
    const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Position and rotate the line
    line.style.width = `${length}px`;
    line.style.left = `${fromX}px`;
    line.style.top = `${fromY}px`;
    line.style.transform = `rotate(${angle}rad)`;
}
function initializeDelete(unit) {
    unit.querySelector('.delete-btn').addEventListener('click', () => {
        connections = connections.filter(conn => 
            conn.from !== unit.dataset.unitId && conn.to !== unit.dataset.unitId
        );
        unit.remove();
        updateConnections();
    });
}

// Add this map to store references to unit data during processing
let pipelineData = new Map();

async function runPipeline() {
    const apiKey = document.getElementById('apiKey').value;
    if (!apiKey) {
        alert('Please enter an API key');
        return;
    }

    // Clear previous pipeline data
    pipelineData.clear();

    // Find starting units (those with no incoming connections)
    const startUnits = Array.from(document.querySelectorAll('.unit')).filter(unit => 
        !connections.some(conn => conn.to === unit.dataset.unitId)
    );

    // Process each starting unit and wait for all pipelines to complete
    try {
        await Promise.all(startUnits.map(unit => processPipeline(unit, apiKey)));
    } catch (error) {
        alert(`Pipeline error: ${error.message}`);
    }
}

async function processPipeline(unit, apiKey) {
    const unitId = unit.dataset.unitId;
    const unitType = unit.querySelector('.unit-header span').textContent.split(' ')[0].toLowerCase();

    try {
        // Process the unit based on its type
        const output = await processUnit(unit, unitType, apiKey);
        
        // Store the output in our pipeline data
        pipelineData.set(unitId, output);
        
        // Only update display for output units
        if (unitType === 'output') {
            const textarea = unit.querySelector('textarea');
            textarea.value = output;
        }

        // Find and process connected units
        const nextConnections = connections.filter(conn => conn.from === unitId);
        await Promise.all(nextConnections.map(conn => {
            const nextUnit = document.querySelector(`[data-unit-id="${conn.to}"]`);
            if (nextUnit) {
                return processPipeline(nextUnit, apiKey);
            }
        }));
    } catch (error) {
        console.error(`Error processing unit ${unitId}:`, error);
        throw error;
    }
}
async function processUnit(unit, unitType, apiKey) {
    const textarea = unit.querySelector('textarea');
    const content = textarea.value;
    const unitId = unit.dataset.unitId;
    const inputConnections = connections.filter(conn => conn.to === unitId);
    
    switch (unitType) {
        case 'input':
            return content;

        case 'output':
            if (inputConnections.length > 0) {
                return pipelineData.get(inputConnections[0].from) || '';
            }
            return '';

        case 'ai':
        case 'custom':
            // Create a map of all input values using the source unit IDs
            const inputs = inputConnections.map(conn => ({
                from: conn.from,
                type: getUnitType(conn.from),
                value: pipelineData.get(conn.from)
            }));
            
            // Replace variables using unit IDs and types
            let processedContent = content;
            inputs.forEach(input => {
                const varPattern = `\\$${input.type}${input.from}`;
                const regex = new RegExp(varPattern, 'g');
                const value = unitType === 'custom' ? `"${input.value}"` : input.value;
                processedContent = processedContent.replace(regex, value);
            });

            if (unitType === 'ai') {
                return await callOpenAI(processedContent, apiKey);
            } else {
                try {
                    const customFunction = new Function('return ' + processedContent);
                    return await customFunction();
                } catch (error) {
                    throw new Error(`Custom code error: ${error.message}`);
                }
            }

        default:
            throw new Error(`Unknown unit type: ${unitType}`);
    }
}

function getUnitType(unitId) {
    const unit = document.querySelector(`[data-unit-id="${unitId}"]`);
    if (!unit) return '';
    return unit.querySelector('.unit-header span').textContent.split(' ')[0].toLowerCase();
}

function replaceVariables(content, inputConnections, isCustomUnit = false) {
    return content.replace(/\$(\w+)(\d+)/g, (match, type, id) => {
        const value = pipelineData.get(id);
        // Only wrap in quotes if it's for a custom unit
        return value !== undefined 
            ? (isCustomUnit ? `"${value}"` : value)
            : match;
    });
}

async function callOpenAI(prompt, apiKey) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        throw new Error(`OpenAI API call failed: ${error.message}`);
    }
}

function saveState() {
    // Collect all unit data
    const units = Array.from(document.querySelectorAll('.unit')).map(unit => ({
        id: unit.dataset.unitId,
        type: unit.querySelector('.unit-header span').textContent.split(' ')[0].toLowerCase(),
        content: unit.querySelector('textarea').value,
        position: {
            left: unit.style.left,
            top: unit.style.top
        }
    }));

    // Create state object
    const state = {
        units,
        connections,
        unitCounter
    };

    // Create and trigger download
    const dataStr = JSON.stringify(state, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'pipeline_state.json';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
}

function loadState(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const state = JSON.parse(e.target.result);
            
            // Clear current state
            document.getElementById('workspace').innerHTML = '';
            connections = [];
            pipelineData.clear();
            
            // Set unit counter
            unitCounter = state.unitCounter;
            
            // Recreate units
            state.units.forEach(unitData => {
                const unit = document.createElement('div');
                unit.className = 'unit';
                unit.dataset.unitId = unitData.id;
                unit.style.left = unitData.position.left;
                unit.style.top = unitData.position.top;

                unit.innerHTML = `
                    <div class="unit-header">
                        <div class="connector input-connector" data-unit="${unitData.id}"></div>
                        <span>${unitData.type.toUpperCase()} ${unitData.id}</span>
                        <div class="connector output-connector" data-unit="${unitData.id}"></div>
                        <span class="delete-btn">×</span>
                    </div>
                    <textarea class="textarea" placeholder="${unitData.type} processing...">${unitData.content}</textarea>
                `;

                document.getElementById('workspace').appendChild(unit);
                initializeDragAndDrop(unit);
                initializeConnectors(unit);
                initializeDelete(unit);
            });
            
            // Recreate connections
            connections = state.connections;
            updateConnections();
            
        } catch (error) {
            alert('Error loading pipeline state: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Add event listeners
document.getElementById('downloadState').addEventListener('click', saveState);

document.getElementById('loadState').addEventListener('click', () => {
    document.getElementById('loadFile').click();
});

document.getElementById('loadFile').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        loadState(e.target.files[0]);
    }
});





document.getElementById('downloadScript').addEventListener('click', generatePipelineScript);

function generatePipelineScript() {
    // Collect all units and sort them topologically
    const units = Array.from(document.querySelectorAll('.unit')).map(unit => ({
        id: unit.dataset.unitId,
        type: unit.querySelector('.unit-header span').textContent.split(' ')[0].toLowerCase(),
        content: unit.querySelector('textarea').value
    }));

    // Generate the script content
    const scriptContent = `
// Generated Pipeline Function
async function runGeneratedPipeline(apiKey, inputs = {}) {
    // Initialize pipeline data storage
    const pipelineData = new Map();
    
    // Store input values
    ${generateInputInitialization()}

    // Process units in order
    ${generateProcessingCode()}

    // Return outputs
    return {
        ${generateOutputCollection()}
    };
}

// Helper function for AI calls
async function callOpenAI(prompt, apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${apiKey}\`
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{
                role: "user",
                content: prompt
            }],
            temperature: 0.7
        })
    });

    if (!response.ok) {
        throw new Error(\`OpenAI API error: \${response.statusText}\`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}`;

    // Create and trigger download
    const dataBlob = new Blob([scriptContent], { type: 'application/javascript' });
    const url = URL.createObjectURL(dataBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'generated_pipeline.js';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    function generateInputInitialization() {
        const inputUnits = units.filter(unit => unit.type === 'input');
        return inputUnits.map(unit => 
            `pipelineData.set("${unit.id}", inputs["input${unit.id}"] || ${JSON.stringify(unit.content)});`
        ).join('\n    ');
    }

    function generateProcessingCode() {
        return units.map(unit => {
            const inputConns = connections.filter(conn => conn.to === unit.id);
            
            switch(unit.type) {
                case 'input':
                    return '// Input units already initialized';
                case 'ai':
                    return `pipelineData.set("${unit.id}", await callOpenAI(${generateContentWithReplacements(unit, inputConns)}, apiKey));`;
                case 'custom':
                    return `pipelineData.set("${unit.id}", await (async () => { ${generateContentWithReplacements(unit, inputConns)} })());`;
                case 'output':
                    if (inputConns.length > 0) {
                        return `pipelineData.set("${unit.id}", pipelineData.get("${inputConns[0].from}"));`;
                    }
                    return `pipelineData.set("${unit.id}", "");`;
            }
        }).filter(code => code).join('\n    ');
    }

    function generateContentWithReplacements(unit, inputConns) {
        let content = unit.content;
        inputConns.forEach(conn => {
            const sourceUnit = units.find(u => u.id === conn.from);
            const varPattern = `\\$${sourceUnit.type}${conn.from}`;
            const regex = new RegExp(varPattern, 'g');
            content = content.replace(regex, `pipelineData.get("${conn.from}")`);
        });
        return content;
    }

    function generateOutputCollection() {
        const outputUnits = units.filter(unit => unit.type === 'output');
        return outputUnits.map(unit => 
            `output${unit.id}: pipelineData.get("${unit.id}")`
        ).join(',\n        ');
    }
}

