// Pump Sizing Calculator - Complete JavaScript

// K-Factors for fittings (standard values)
const fittingKFactors = {
    'Elbows, 90LR': 0.27,
    'Elbows, 45LR': 0.20,
    'Tees, Thru': 0.66,
    'Tees, Branch': 1.07,
    'Ball Valve': 0.20,
    'Butterfly Valve': 0.34,
    'Gate Valve': 0.14,
    'Globe Valve': 5.32,
    'Check Valve': 2.00,
    'Plug Valve': 0.34,
    'Pipe Entrance / Exit': 0.50
};

const fittingNames = [
    'Elbows, 90LR', 'Elbows, 45LR', 'Tees, Thru', 'Tees, Branch',
    'Ball Valve', 'Butterfly Valve', 'Gate Valve', 'Globe Valve',
    'Check Valve', 'Plug Valve', 'Pipe Entrance / Exit'
];

// Global results storage
let currentResults = null;

// Initialize date
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    document.getElementById('calcDate').value = today.toLocaleString();
    
    // Build fittings UI
    buildFittingsUI();
    
    // Add calculate event
    document.getElementById('calculateBtn').addEventListener('click', calculatePump);
    document.getElementById('exportBtn').addEventListener('click', exportToExcel);
});

function buildFittingsUI() {
    const suctionDiv = document.getElementById('suctionFittings');
    const dischargeDiv = document.getElementById('dischargeFittings');
    
    fittingNames.forEach(name => {
        const k = fittingKFactors[name];
        
        // Suction fitting
        const suctionItem = document.createElement('div');
        suctionItem.className = 'fitting-item';
        suctionItem.innerHTML = `
            <label>${name}</label>
            <input type="number" step="0.01" value="${k}" class="suction-fitting" data-fitting="${name}">
        `;
        suctionDiv.appendChild(suctionItem);
        
        // Discharge fitting
        const dischargeItem = document.createElement('div');
        dischargeItem.className = 'fitting-item';
        dischargeItem.innerHTML = `
            <label>${name}</label>
            <input type="number" step="0.01" value="0" class="discharge-fitting" data-fitting="${name}">
        `;
        dischargeDiv.appendChild(dischargeItem);
    });
}

function getFittingValues(side) {
    const selector = side === 'suction' ? '.suction-fitting' : '.discharge-fitting';
    const inputs = document.querySelectorAll(selector);
    let totalK = 0;
    inputs.forEach(input => {
        totalK += parseFloat(input.value) || 0;
    });
    return totalK;
}

function getFittingDetails(side) {
    const selector = side === 'suction' ? '.suction-fitting' : '.discharge-fitting';
    const inputs = document.querySelectorAll(selector);
    const details = [];
    inputs.forEach(input => {
        const val = parseFloat(input.value) || 0;
        if (val > 0) {
            details.push({
                name: input.dataset.fitting,
                k: val
            });
        }
    });
    return details;
}

function calculatePump() {
    // Get all input values
    const flowrate = parseFloat(document.getElementById('flowrate').value);
    const density = parseFloat(document.getElementById('density').value);
    const viscosity = parseFloat(document.getElementById('viscosity').value);
    const vaporPressure = parseFloat(document.getElementById('vaporPressure').value);
    const pumpEff = parseFloat(document.getElementById('pumpEfficiency').value) / 100;
    
    // Suction
    const suctionOpPress = parseFloat(document.getElementById('suctionOpPress').value);
    const suctionStaticHead = parseFloat(document.getElementById('suctionStaticHead').value);
    const suctionEqLoss = parseFloat(document.getElementById('suctionEqLoss').value);
    const suctionLength = parseFloat(document.getElementById('suctionLength').value);
    const suctionPipe = document.getElementById('suctionPipe').value.split(',');
    const suctionID = parseFloat(suctionPipe[1]);
    
    // Discharge
    const dischargeOpPress = parseFloat(document.getElementById('dischargeOpPress').value);
    const dischargeStaticHead = parseFloat(document.getElementById('dischargeStaticHead').value);
    const dischargeEqLoss = parseFloat(document.getElementById('dischargeEqLoss').value);
    const dischargeLength = parseFloat(document.getElementById('dischargeLength').value);
    const dischargePipe = document.getElementById('dischargePipe').value.split(',');
    const dischargeID = parseFloat(dischargePipe[1]);
    
    // Convert units
    const areaSuction = Math.PI * Math.pow(suctionID / 12, 2) / 4;
    const areaDischarge = Math.PI * Math.pow(dischargeID / 12, 2) / 4;
    
    const velocity = (flowrate / 448.831) / areaSuction; // ft/s
    
    // Reynolds Number
    const rho = density;
    const mu = viscosity * 0.000672; // cP to lb/ft·s
    const reynolds = (rho * velocity * (suctionID / 12)) / mu;
    
    // Friction factor (simplified - turbulent)
    let f = 0.02;
    if (reynolds < 2000) f = 64 / reynolds;
    else f = 0.02;
    
    // Pipe friction loss (psi/100ft)
    const pipeLossPer100ft = f * (velocity * velocity) * density / (2 * 32.2 * (suctionID / 12)) * (100 / (suctionID / 12)) / 144;
    
    // Suction pipe friction loss
    const suctionPipeLoss = pipeLossPer100ft * (suctionLength / 100);
    
    // Discharge pipe friction loss
    const dischargePipeLoss = pipeLossPer100ft * (dischargeLength / 100);
    
    // Fitting losses
    const suctionFittingK = getFittingValues('suction');
    const dischargeFittingK = getFittingValues('discharge');
    
    const velocityHead = (velocity * velocity) / (2 * 32.2); // ft
    
    const suctionFittingLossPsi = suctionFittingK * velocityHead * density / 144;
    const dischargeFittingLossPsi = dischargeFittingK * velocityHead * density / 144;
    
    // Pressure calculations
    const suctionStaticPsi = suctionStaticHead * density / 144;
    const dischargeStaticPsi = dischargeStaticHead * density / 144;
    
    const suctionPressure = suctionOpPress + suctionStaticPsi - suctionEqLoss - suctionPipeLoss - suctionFittingLossPsi;
    const dischargePressure = dischargeOpPress + dischargeStaticPsi + dischargeEqLoss + dischargePipeLoss + dischargeFittingLossPsi;
    
    // Differential
    const diffPressure = dischargePressure - suctionPressure;
    const diffHead = diffPressure * 144 / density;
    
    // Hydraulic Power (BHP)
    const hydraulicPower = (flowrate * diffHead * density) / (3960 * 62.4) * 62.4 / density;
    const pumpBHP = hydraulicPower / pumpEff;
    
    // NPSH Available
    const atmPressure = 14.7; // psi
    const npshAvailable = (suctionPressure - vaporPressure) * 144 / density + suctionStaticHead;
    
    // Store results
    currentResults = {
        project: {
            name: document.getElementById('projectName').value,
            developedBy: document.getElementById('developedBy').value,
            date: document.getElementById('calcDate').value,
            revision: document.getElementById('revision').value
        },
        fluid: {
            flowrate, density, viscosity, vaporPressure, pumpEff: pumpEff * 100
        },
        suction: {
            opPress: suctionOpPress, staticHead: suctionStaticHead, eqLoss: suctionEqLoss,
            length: suctionLength, pipeSize: suctionPipe[0], pipeID: suctionID,
            velocity, reynolds, pipeLoss: suctionPipeLoss, fittingLoss: suctionFittingLossPsi,
            finalPressure: suctionPressure, fittings: getFittingDetails('suction')
        },
        discharge: {
            opPress: dischargeOpPress, staticHead: dischargeStaticHead, eqLoss: dischargeEqLoss,
            length: dischargeLength, pipeSize: dischargePipe[0], pipeID: dischargeID,
            pipeLoss: dischargePipeLoss, fittingLoss: dischargeFittingLossPsi,
            finalPressure: dischargePressure, fittings: getFittingDetails('discharge')
        },
        results: {
            diffPressure, diffHead, hydraulicPower, pumpBHP, npshAvailable
        }
    };
    
    displayResults();
    document.getElementById('exportBtn').disabled = false;
}

function displayResults() {
    const res = currentResults;
    
    // Show results container
    document.getElementById('resultsContainer').style.display = 'block';
    document.getElementById('noResults').style.display = 'none';
    
    // Summary Grid
    const summaryGrid = document.getElementById('summaryGrid');
    summaryGrid.innerHTML = `
        <div class="summary-item">
            <div class="summary-label">Flowrate</div>
            <div class="summary-value">${res.fluid.flowrate}</div>
            <div class="summary-unit">US gpm</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Differential Pressure</div>
            <div class="summary-value">${res.results.diffPressure.toFixed(2)}</div>
            <div class="summary-unit">psi</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Differential Head</div>
            <div class="summary-value">${res.results.diffHead.toFixed(1)}</div>
            <div class="summary-unit">ft</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Hydraulic Power</div>
            <div class="summary-value">${res.results.hydraulicPower.toFixed(2)}</div>
            <div class="summary-unit">bhp</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Pump BHP</div>
            <div class="summary-value">${res.results.pumpBHP.toFixed(2)}</div>
            <div class="summary-unit">bhp</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">NPSH Available</div>
            <div class="summary-value">${res.results.npshAvailable.toFixed(2)}</div>
            <div class="summary-unit">ft</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Pump Efficiency</div>
            <div class="summary-value">${res.fluid.pumpEff}</div>
            <div class="summary-unit">%</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Velocity</div>
            <div class="summary-value">${res.suction.velocity.toFixed(2)}</div>
            <div class="summary-unit">ft/s</div>
        </div>
    `;
    
    // Hydraulic Table
    const hydraulicBody = document.querySelector('#hydraulicTable tbody');
    hydraulicBody.innerHTML = `
        <tr><td>Operating Pressure (psi)</td><td>${res.suction.opPress.toFixed(2)}</td><td>${res.discharge.opPress.toFixed(2)}</td></tr>
        <tr><td>Static Head (ft)</td><td>${res.suction.staticHead.toFixed(2)}</td><td>${res.discharge.staticHead.toFixed(2)}</td></tr>
        <tr><td>Equipment Loss (psi)</td><td>${res.suction.eqLoss.toFixed(2)}</td><td>${res.discharge.eqLoss.toFixed(2)}</td></tr>
        <tr><td>Length (ft)</td><td>${res.suction.length.toFixed(0)}</td><td>${res.discharge.length.toFixed(0)}</td></tr>
        <tr><td>Pipe Selected</td><td>${res.suction.pipeSize}", Sch 40</td><td>${res.discharge.pipeSize}", Sch 40</td></tr>
        <tr><td>Pipe Inside Diameter (inch)</td><td>${res.suction.pipeID.toFixed(2)}</td><td>${res.discharge.pipeID.toFixed(2)}</td></tr>
        <tr><td>Velocity (ft/s)</td><td>${res.suction.velocity.toFixed(2)}</td><td>${res.suction.velocity.toFixed(2)}</td></tr>
        <tr><td>Reynold's Number</td><td>${Math.round(res.suction.reynolds)}</td><td>${Math.round(res.suction.reynolds)}</td></tr>
        <tr><td>Pipe ΔP (psi/100 ft)</td><td>${(res.suction.pipeLoss * 100 / res.suction.length).toFixed(2)}</td><td>${(res.discharge.pipeLoss * 100 / res.discharge.length).toFixed(2)}</td></tr>
        <tr><td>Pressure at Pump (psi)</td><td>${res.suction.finalPressure.toFixed(2)}</td><td>${res.discharge.finalPressure.toFixed(2)}</td></tr>
    `;
    
    // Fitting Table
    const fittingBody = document.querySelector('#fittingTable tbody');
    const allFittings = [...new Set([...res.suction.fittings.map(f => f.name), ...res.discharge.fittings.map(f => f.name)])];
    fittingBody.innerHTML = allFittings.map(name => {
        const suctionFit = res.suction.fittings.find(f => f.name === name);
        const dischargeFit = res.discharge.fittings.find(f => f.name === name);
        return `<tr>
            <td>${name}</td>
            <td>${suctionFit ? suctionFit.k.toFixed(2) : '0.00'}</td>
            <td>${dischargeFit ? dischargeFit.k.toFixed(2) : '0.00'}</td>
        </tr>`;
    }).join('');
    
    // Add total row
    const totalK = `
        <tr style="font-weight: bold; background-color: #e9ecef;">
            <td><strong>Total ΔP, psi</strong></td>
            <td><strong>${(res.suction.fittingLoss).toFixed(3)}</strong></td>
            <td><strong>${(res.discharge.fittingLoss).toFixed(3)}</strong></td>
        </tr>
    `;
    fittingBody.insertAdjacentHTML('beforeend', totalK);
    
    // Final Results
    const finalDiv = document.getElementById('finalResults');
    finalDiv.innerHTML = `
        <div class="final-item">
            <div class="final-label">Differential Pressure</div>
            <div class="final-value">${res.results.diffPressure.toFixed(2)}</div>
            <div class="final-unit">psi</div>
        </div>
        <div class="final-item">
            <div class="final-label">Differential Head</div>
            <div class="final-value">${res.results.diffHead.toFixed(1)}</div>
            <div class="final-unit">ft</div>
        </div>
        <div class="final-item">
            <div class="final-label">Hydraulic Power</div>
            <div class="final-value">${res.results.hydraulicPower.toFixed(2)}</div>
            <div class="final-unit">bhp</div>
        </div>
        <div class="final-item">
            <div class="final-label">Pump BHP</div>
            <div class="final-value">${res.results.pumpBHP.toFixed(2)}</div>
            <div class="final-unit">bhp</div>
        </div>
        <div class="final-item">
            <div class="final-label">NPSH Available</div>
            <div class="final-value">${res.results.npshAvailable.toFixed(2)}</div>
            <div class="final-unit">ft</div>
        </div>
    `;
    
    // Scroll to results
    document.getElementById('resultsContainer').scrollIntoView({ behavior: 'smooth' });
}

function exportToExcel() {
    if (!currentResults) return;
    
    const res = currentResults;
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Summary
    const summaryData = [
        ['Project', res.project.name],
        ['Developed By', res.project.developedBy],
        ['Date', res.project.date],
        ['Revision', res.project.revision],
        [''],
        ['PUMP SIZING SUMMARY'],
        ['Parameter', 'Value', 'Unit'],
        ['Flowrate', res.fluid.flowrate, 'US gpm'],
        ['Density', res.fluid.density, 'lb/ft³'],
        ['Viscosity', res.fluid.viscosity, 'cP'],
        ['Vapor Pressure', res.fluid.vaporPressure, 'psi'],
        ['Pump Efficiency', res.fluid.pumpEff, '%'],
        [''],
        ['Differential Pressure', res.results.diffPressure.toFixed(2), 'psi'],
        ['Differential Head', res.results.diffHead.toFixed(1), 'ft'],
        ['Hydraulic Power', res.results.hydraulicPower.toFixed(2), 'bhp'],
        ['Pump BHP', res.results.pumpBHP.toFixed(2), 'bhp'],
        ['NPSH Available', res.results.npshAvailable.toFixed(2), 'ft'],
        ['Velocity', res.suction.velocity.toFixed(2), 'ft/s']
    ];
    
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{wch:25}, {wch:15}, {wch:10}];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
    
    // Sheet 2: Hydraulic Data
    const hydraulicData = [
        ['Hydraulic Data', '', ''],
        ['Parameter', 'Suction', 'Discharge'],
        ['Operating Pressure (psi)', res.suction.opPress, res.discharge.opPress],
        ['Static Head (ft)', res.suction.staticHead, res.discharge.staticHead],
        ['Equipment Loss (psi)', res.suction.eqLoss, res.discharge.eqLoss],
        ['Length (ft)', res.suction.length, res.discharge.length],
        ['Pipe Selected', `${res.suction.pipeSize}", Sch 40`, `${res.discharge.pipeSize}", Sch 40`],
        ['Pipe Inside Diameter (inch)', res.suction.pipeID, res.discharge.pipeID],
        ['Velocity (ft/s)', res.suction.velocity, res.suction.velocity],
        ["Reynold's Number", Math.round(res.suction.reynolds), Math.round(res.suction.reynolds)],
        ['Pipe ΔP (psi/100 ft)', (res.suction.pipeLoss * 100 / res.suction.length).toFixed(2), (res.discharge.pipeLoss * 100 / res.discharge.length).toFixed(2)],
        ['Pressure at Pump (psi)', res.suction.finalPressure.toFixed(2), res.discharge.finalPressure.toFixed(2)]
    ];
    
    const ws2 = XLSX.utils.aoa_to_sheet(hydraulicData);
    ws2['!cols'] = [{wch:30}, {wch:15}, {wch:15}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Hydraulic Data');
    
    // Sheet 3: Fitting Loss
    const fittingData = [['Pipe Fitting Loss', 'Suction K', 'Discharge K']];
    const allFits = [...new Set([...res.suction.fittings.map(f => f.name), ...res.discharge.fittings.map(f => f.name)])];
    allFits.forEach(name => {
        const s = res.suction.fittings.find(f => f.name === name);
        const d = res.discharge.fittings.find(f => f.name === name);
        fittingData.push([name, s ? s.k : 0, d ? d.k : 0]);
    });
    fittingData.push(['Total ΔP, psi', res.suction.fittingLoss.toFixed(3), res.discharge.fittingLoss.toFixed(3)]);
    
    const ws3 = XLSX.utils.aoa_to_sheet(fittingData);
    ws3['!cols'] = [{wch:30}, {wch:12}, {wch:12}];
    XLSX.utils.book_append_sheet(wb, ws3, 'Fitting Loss');
    
    // Sheet 4: Final Results
    const finalData = [
        ['RESULT', '', ''],
        ['Differential Pressure', `${res.results.diffPressure.toFixed(2)} psi`, ''],
        ['Differential Head', `${res.results.diffHead.toFixed(1)} ft`, ''],
        ['Hydraulic Power', `${res.results.hydraulicPower.toFixed(2)} bhp`, ''],
        ['Pump BHP', `${res.results.pumpBHP.toFixed(2)} bhp`, ''],
        ['NPSH Available', `${res.results.npshAvailable.toFixed(2)} ft`, '']
    ];
    
    const ws4 = XLSX.utils.aoa_to_sheet(finalData);
    ws4['!cols'] = [{wch:25}, {wch:20}];
    XLSX.utils.book_append_sheet(wb, ws4, 'Result');
    
    // Download
    const fileName = `Pump_Sizing_${res.project.name}_${res.project.date.replace(/[/, :]/g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
}