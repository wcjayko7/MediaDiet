// 1. SETUP
const width = 900;
const height = 600;
const margin = { top: 50, right: 50, bottom: 50, left: 50 };

// LABELS MAP
const displayNames = {
    "overall": "All Adults",
    "dem": "Democrats",
    "rep": "Republicans",
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
d3.json("data2.json").then(data => {

    // --- SCALES ---
    const x = d3.scaleLinear()
        .domain([-15, 15]) 
        .range([margin.left, width - margin.right]);

    const size = d3.scaleSqrt()
        .domain([0, 20]) 
        .range([8, 50]); // Max bubble size 50px

    const opacityScale = d3.scaleLinear()
        .domain([0, 20])
        .range([0.3, 1]);

    // --- GRID LINES ---
    const gridTicks = [-15, -10, -5, 0, 5, 10, 15];

    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0, ${height - 50})`)
        .call(d3.axisBottom(x)
            .tickValues(gridTicks)
            .tickSize(-(height - 100))
            .tickFormat("")
        )
        .call(g => g.select(".domain").remove())
        .attr("stroke-dasharray", "2,2")
        .attr("opacity", 0.15);

    // Center Line
    svg.append("line")
        .attr("x1", x(0))
        .attr("x2", x(0))
        .attr("y1", height - 50)
        .attr("y2", 50)
        .attr("stroke", "#333")
        .attr("stroke-width", 1);

    // Axis Labels
    svg.append("g")
        .attr("transform", `translate(0, ${height - 50})`)
        .call(d3.axisBottom(x).tickValues(gridTicks).tickFormat(d => d + "%"))
        .style("font-size", "14px")
        .style("opacity", 0.7);

    // --- SIZE LEGEND (New Section) ---
    // We place this in the top right corner
    const legendValues = [5, 10, 20];
    const legendX = width - 200;
    const legendY = 150; 

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    // Title
    const legendTitle = legend.append("text")
        .attr("x", 250)
        .attr("y", -60) // Moved up slightly to fit 2 lines
        .attr("text-anchor", "left")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("fill", "#666");

    legendTitle.append("tspan")
        .text("Bubble size represents the")
        .attr("x", 70)
        .attr("dy", "0em");

    legendTitle.append("tspan")
        .text("magnitude of percent difference ")
        .attr("x", 70)
        .attr("dy", "1.2em"); // Next line down

    legendTitle.append("tspan")
        .text("in the overall samples")
        .attr("x", 70)
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
        .attr("r", d => size(Math.abs(d.overall || 0))) 
        .attr("stroke", "none")
        .attr("stroke-width", 0)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#000").attr("stroke-width", 2);
            tooltip.transition().duration(200).style("opacity", 1);
            
            const humanLabel = displayNames[currentKey] || "Value"; 
            const val = d[currentKey] !== undefined ? d[currentKey] : 0;
            const overallVal = d.overall !== undefined ? d.overall : "?";
            const sign = val > 0 ? "+" : "";

            tooltip.html(`
                <strong>${d.source}</strong><br/>
                ${humanLabel}: ${sign}${val}%<br/>
                <small style="color:#666">(Overall diff: ${overallVal}%)</small>
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "none").attr("stroke-width", 0);
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // --- PREPARE LABELS (Initially Empty) ---
    const label = svg.append("g")
        .selectAll("text")
        .data(data)
        .join("text")
        .text("") // Text is set in updateChart
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "black") 
        .style("pointer-events", "none"); 

    // --- CALCULATE STATIC WINNERS (Top 10 Overall) ---
    const top10Overall = new Set(
        [...data]
        .sort((a, b) => Math.abs(b.overall || 0) - Math.abs(a.overall || 0))
        .slice(0, 10)
        .map(d => d.source)
    );

    // --- SIMULATION ---
    const simulation = d3.forceSimulation(data)
        .force("x", d3.forceX(d => x(d[currentKey])).strength(0.8))
        .force("y", d3.forceY(height / 2).strength(0.1)) 
        .force("collide", d3.forceCollide(d => size(Math.abs(d.overall || 0)) + 2))
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
        
        // Find Top 2 POSITIVE (Largest numbers > 0)
        const top2Pos = new Set(
            [...data]
            .sort((a, b) => (b[key] || 0) - (a[key] || 0)) // Sort Descending
            .slice(0, 2)
            .map(d => d.source)
        );

        // Find Top 2 NEGATIVE (Smallest numbers < 0)
        const top2Neg = new Set(
            [...data]
            .sort((a, b) => (a[key] || 0) - (b[key] || 0)) // Sort Ascending
            .slice(0, 2)
            .map(d => d.source)
        );

        // 2. COMBINE ALL LABELS
        const visibleLabels = new Set([...top10Overall, ...top2Pos, ...top2Neg]);

        // 3. APPLY LABELS
        label.text(d => visibleLabels.has(d.source) ? d.source : "");

        node.interrupt();

        node.transition().duration(750)
            .attr("fill", d => d[currentKey] >= 0 ? "#4CAF50" : "#F44336")
            .attr("fill-opacity", d => {
                const val = Math.abs(d[currentKey] || 0);
                return val > 20 ? 1 : opacityScale(val);
            });

        simulation.force("x", d3.forceX(d => x(d[currentKey])).strength(0.8));
        simulation.alpha(1).restart();
    };

    window.updateChart("overall");
});