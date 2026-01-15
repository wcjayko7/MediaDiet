// 1. SETUP
const width = 900;
const height = 600;
const margin = { top: 50, right: 50, bottom: 50, left: 50 };

// --- LABELS DICTIONARY ---
const displayNames = {
    "overall": "Overall",
    "dem": "Democrats",
    "rep": "Republicans",
    "male": "Men",
    "female": "Women",
    "age18": "Ages 18-29",
    "age30": "Ages 30-49",
    "age50": "Ages 50-64",
    "age65": "Ages 65+"
};

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .style("overflow", "visible");

// Tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #333")
    .style("padding", "8px")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("z-index", "10");

// 2. LOAD DATA
d3.json("data.json").then(data => {

    // --- SCALES ---
    // X Axis Scale
    const x = d3.scaleLinear()
        .domain([0, 60]) 
        .range([margin.left, width - margin.right]);

    const size = d3.scaleLinear()
        .domain([0, 35]) 
        .range([2, 50]); // Max bubble size 50px

    const opacityScale = d3.scaleLinear()
        .domain([0, 20])
        .range([0.3, 1]);

    // --- AXIS & GRID LINES ---
    const gridTicks = [0, 10, 20, 30, 40, 50, 60];
    // 1. Draw Grid Lines (Dotted)
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0, ${height - 50})`) // Position at bottom
        .call(d3.axisBottom(x)
            .ticks(6)
            .tickSize(-(height - 100)) // Extend lines UPWARD by height of chart
            .tickFormat("") // No numbers on the grid lines
        )
        .call(g => g.select(".domain").remove()) // Remove the solid bottom line
        .attr("stroke-dasharray", "2,2") // <--- This makes them DOTTED
        .attr("opacity", 0.2); // Very faint light grey

    // 2. Draw Axis Labels (The Numbers)
    const xAxis = d3.axisBottom(x).ticks(6).tickFormat(d => d + "%");
    svg.append("g")
        .attr("transform", `translate(0, ${height - 50})`)
        .call(xAxis)
        .style("font-size", "14px")
        .style("opacity", 0.5);
    // --- SIZE LEGEND (New Section) ---
    // We place this in the top right corner
    const legendValues = [5, 10, 20];
    const legendX = width - 250;
    const legendY = 100; 

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    // Title
    const legendTitle = legend.append("text")
        .attr("x", 100)
        .attr("y", -40) // Moved up slightly to fit 2 lines
        .attr("text-anchor", "left")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("fill", "#666");

    legendTitle.append("tspan")
        .text("Bubble size represents the")
        .attr("x", 30)
        .attr("dy", "0em");

    legendTitle.append("tspan")
        .text("magnitude of percent")
        .attr("x", 30)
        .attr("dy", "1.2em"); // Next line down

    legendTitle.append("tspan")
        .text("in the overall sample")
        .attr("x", 30)
        .attr("dy", "1.2em"); // Next line down

    // Draw Nested Circles
    legend.selectAll("circle")
        .data(legendValues)
        .join("circle")
        .attr("cx", 0)
        .attr("cy", d => -size(d)) // Shift up so they share a bottom point
        .attr("r", d => size(d))
        .attr("fill", "none")
        .attr("stroke", "#bbb")
        .attr("stroke-dasharray", "2,2"); // Dotted lines

    // Draw Text Labels on top of circles
    legend.selectAll(".val-label")
        .data(legendValues)
        .join("text")
        .attr("class", "val-label")
        .attr("x", 0)
        .attr("y", d => -size(d) * 2 - 2) // Place at the very top of each ring
        .text(d => d + "%")
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", "#999");

    // --- DRAW BUBBLES ---
    let currentKey = "overall";

    const node = svg.append("g")
        .selectAll("circle")
        .data(data)
        .join("circle")
        // CHANGED: Size is now permanent based on 'overall' score
        .attr("r", d => size(d.overall)) 
        .attr("fill", "#69b3a2")
        // --- HOVER EVENTS ---
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "#4e8a7c").attr("stroke", "#333");
            tooltip.transition().duration(200).style("opacity", 1);
            
            // LOOKUP THE HUMAN NAME
            const humanLabel = displayNames[currentKey] || currentKey; 

            tooltip.html(`
                <strong>${d.source}</strong><br/>
                ${humanLabel}: ${d[currentKey]}%<br/>
                <small style="color:#666">(Overall: ${d.overall}%)</small>
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill", "#69b3a2").attr("stroke", "white");
            tooltip.transition().duration(500).style("opacity", 0);
        });

   // --- PREPARE LABELS (Text is empty at first) ---
    const label = svg.append("g")
        .selectAll("text")
        .data(data)
        .join("text")
        .text("") // We set text in updateChart now
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "white")
        .style("pointer-events", "none")
        .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.5)");

    // --- CALCULATE STATIC WINNERS (Top 10 Overall) ---
    // These get saved once and never disappear
    const top10Overall = new Set(
        [...data]
        .sort((a, b) => b.overall - a.overall)
        .slice(0, 10)
        .map(d => d.source)
    );

    // --- SIMULATION ---
    const simulation = d3.forceSimulation(data)
        .force("x", d3.forceX(d => x(d[currentKey])).strength(0.5))
        .force("y", d3.forceY(height / 2).strength(0.08)) 
        .force("collide", d3.forceCollide(d => size(d.overall) + 1))
        .on("tick", ticked);

    function ticked() {
        node.attr("cx", d => d.x).attr("cy", d => d.y);
        label.attr("x", d => d.x).attr("y", d => d.y);
    }

    // --- UPDATE FUNCTION ---
    window.updateChart = function(key) {
        if (!data[0].hasOwnProperty(key)) return;
        currentKey = key;

        d3.selectAll(".controls button").classed("active", false);
        d3.select("#btn-" + key).classed("active", true);

        // 1. CALCULATE DYNAMIC LABELS
        // Find top 2 for THIS specific group
        const top2ForGroup = new Set(
            [...data]
            .sort((a, b) => b[key] - a[key]) // Sort by currently clicked category
            .slice(0, 2)
            .map(d => d.source)
        );

        // 2. COMBINE LABELS (Set removes duplicates automatically)
        const visibleLabels = new Set([...top10Overall, ...top2ForGroup]);

        // 3. APPLY LABELS
        label.text(d => visibleLabels.has(d.source) ? d.source : "");

        node.interrupt();

        simulation.force("x", d3.forceX(d => x(d[currentKey])).strength(0.5));
        simulation.force("collide", d3.forceCollide(d => size(d.overall) + 1));
        
        simulation.alpha(1).restart();
    };

    // Initialize
    window.updateChart("overall");
});

