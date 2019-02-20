"use strict";

// Cytoscape variable: 
var cy = cytoscape({
	container: document.getElementById("cy"),	// Div where we'll put the Cytoscape visualization
	minZoom: 5e-1,
	maxZoom: 40,

	style: [		// Graph stylesheet 
		{ selector: 'node',
			style: {
				'background-color': '#666',
				'label': 'data(name)',
				'font-size': 5,
				'width': function (ele) {
					return 2 + 2 * Math.log2(ele.degree(true));
				},
				'height': function (ele) {
					return 2 + 2 *  Math.log2(ele.degree(true));
				},
				'border-width': 0.4,
				'padding': '30%',
				'background-color': function (ele) {
					if (ele.hasClass('named')) {
						return 'green';
					} else {
						return 'lightgrey';
					}
				},
				'color': function (ele) {
					if (ele.hasClass('named')) {
						return 'white';
					} else {
						return 'white';
					}
				},
				'opacity': 0.9			
			}
		},
		{ selector: 'edge',
	      		style: {
	        		'width': function(ele){
					return (0.9 + Math.log2(ele.data('number_interactions')));
				}, 
	        		'line-color': '#bbb',
				'opacity': 0.9 
					
	      		}
	    	}
	  ],
});

// setFile: Takes an file selection event and displays the graph
var setFile = (evt) => {
	console.log('Loading file...');
	let file = evt.target.files[0];
	csv_to_json(file).then((json) => {
		setElements(json.data);
	});
};


// Takes a CSV file and returns a *promise* containing converted JSON
// NOTE: the JSON is contaiend in response.data
var csv_to_json = (csv) => {

	console.log('Converting CSV to JSON...');
	// Using Papa for the CSV => JSON conversion	
	return new Promise(function(complete, error) {
		Papa.parse(csv, {
			header: true,
			complete, error
		});
	});
};

// Takes JSON extracted from CSV file; formats for Cytoscape
var setElements = (json) => {
	console.log('Parsing JSON...');
	// startBatch prevents Cytoscape from rendering elements as we add and change them
	cy.startBatch();
	
	for (let i = 0; i < json.length; i++){
		let bait_name = json[i]["Bait Name"];
		let bait_locus = json[i]["Bait Locus"];
		let bait_notes = json[i]["Bait Notes"];
		let prey_locus = json[i]["Prey Locus"];
		let prey_tair = json[i]["Prey TAIR Symbols"];
		let prey_description = json[i]["Prey TAIR Description"];
		let number_interactions = json[i]["Number of Interactions"];

		if (bait_locus == ''){ break; }

		// Add bait protein node
		let bait = cy.$id(bait_locus);	
		if (bait.length == 0) {
			bait = cy.add({
				group: 'nodes',
				data: {
					id: bait_locus,
					name: bait_locus,
				}
			});
		}

		// If bait has a name, and if the node hasn't been named, then add one
		if (!bait.hasClass('named') && (bait_name != "")) {
			bait.addClass('named');
			bait.data('name', bait_name);
		}	
	
		// If the node doesn't already have bait notes, add it
		if (!bait.data('bait_notes') && bait_notes) {
			bait.data('bait_notes', bait_notes);
		}
	
		// Add prey protein node
		let prey = cy.$id(prey_locus);
		if (prey.length == 0) {
                        prey = cy.add({
                                group: 'nodes',
                                data: {
                                        id: prey_locus,
					name: prey_locus,
                                }   
                        }); 
                }	

		// If the node doesn't have prey_tair, add it
		if (!prey.data('prey_tair') && prey_tair) {
			prey.data('prey_tair', prey_tair);
		}

		// If the node doesn't have prey_description, add it
		if (!prey.data('prey_description') && prey_description) {
			prey.data('prey_description', prey_description);
		}
	
		// Add edge; ignore duplicates
		let edge_id = bait_locus + '_' + prey_locus;
		if (cy.$id(edge_id).length == 0) {
			cy.add({
				group: 'edges',
				data: {
					id: edge_id,
					source: bait_locus,
					target: prey_locus,
					number_interactions: number_interactions,		
				},
			});
		} else {
			console.log('duplicate entry: ' + edge_id);
		}
	}


	colorClusters(cy.elements());

	// 'Cose': a particular built-in layout (for positioning nodes)
	var layout = cy.layout({
		name: 'cose',
		nodeDimensionsIncludeLabels: true,
		fit: true,
		padding: 20,
		nodeRepulsion: function( node ){ return 10000; },
		nodeOverlap: 4,
	}); 

	// Layout doesn't affect the graph until it's run
	console.log('Applying layout...');
        layout.run();

	focused.select(cy.elements());

	cy.endBatch();
	// Fits the screen to the entire collection of nodes	

	console.log('Graph ready!');
};

// Find Markov clusters and color them randomly
var colorClusters = (elements) => {
	console.log('Identifying Markov clusters...');
	let clusters = elements.markovClustering();

	console.log('Coloring graph...');
	for(let i = 0; i < clusters.length; i++) {
		let clusterColor = randomColor();
		let cluster = clusters[i];

		// Might as well remember the clusters by indices
		cluster.data('cluster', i);
		cluster.data('cluster_color', clusterColor);
	}

	// The clusters are of nodes and not edges
	// Thus, we must color edges by the average color of their connected nodes 
	cy.edges().style('line-color', function(edge) {
		let c1 = edge.source().data('cluster_color');
		let c2 = edge.target().data('cluster_color');
		return averageColor(c1, c2);
	});

};


// Add event listener for file button
document.getElementById('files').addEventListener('change', setFile, false);

// Add event listener for the spacebar
window.addEventListener("keydown", keypress, false);

// If the spacebar is pressed, we re-center to the entire graph
function keypress(e) {
        if (e.key == 'z' && e.metaKey) {
                focused.back();
        }else if (e.key == ' ') {
		focused.clear();
	}
};

// Upon clicking a node, hide any edge or node that isn't connected
cy.on('click', 'node', function(evt){
	let node = evt.target;
	let clicks = evt.originalEvent.detail;
	if (evt.originalEvent.shiftKey) {
		focused.shiftclick(node, clicks + 1);
	}else {
		focused.click(node, clicks + 1);
	}
});

// focusedElements: Provides functionality for setting specific nodes "in focus"
// Keeps a stack of views for the user to easily revert back 
class elementTracker {

	// Keep a stack to maintain state 
	elementStack = [];
	stackSize = 0;
	
	constructor(elements) {
		if (elements) {
			this.select(elements);
		} 	
	}

	viewSelected() {
		this.elements.style('opacity', 0.9);
		this.elements.complement().style('opacity', 0.1);
		cy.fit(this.elements);
	}

	select (elements) {
                this.elementStack[this.stackSize] = elements;
                this.stackSize++;
		this.viewSelected();
	}

	addElements(elements) {
		this.select(this.elements.union(elements));	
	}

	get elements() {
		return this.elementStack[this.stackSize - 1];
	}

	clear() {
		this.select(cy.elements());
	}

	back() {
		if (this.stackSize == 1 ){
			return;
		} else {
			this.stackSize --;
			this.viewSelected();	
		}
	}

	// Find every element within n connections of the specified elements
	getNeighborhood (elements, n) {
		if (n == 1) {
			return elements;	
		} else {
			return this.getNeighborhood(elements.union(elements.neighborhood()), n-1);
		}
	}

	click(elements, n) {
		this.select(this.getNeighborhood(elements, n));
	}

	shiftclick(elements, n) {
		this.addElements(this.getNeighborhood(elements, n));
	}
}

var focused = new elementTracker();


// Generate a random color
var randomColor = function() {
	//random 2-digit numbers between 0 and 255
	let r = (1<<8)*Math.random()|0;
	let g = (1<<8)*Math.random()|0;
	let b = (1<<8)*Math.random()|0;

	// We pick a number between 0 and 255 to bias the brightness
	let ratio = 181 / Math.max(r, g, b);
	r *= ratio;
	g *= ratio;
	b *= ratio;
	return makeColor(r, g, b);
}

// Averages to colors in the form #rrggbb
var averageColor = function(c1, c2) {
	// Substring starts at index 1: we ignore the '#'
	let r1 = parseInt(c1.substring(1, 3), 16);
	let r2 = parseInt(c2.substring(1, 3), 16);
        let g1 = parseInt(c1.substring(3, 5), 16);
        let g2 = parseInt(c2.substring(3, 5), 16);
        let b1 = parseInt(c1.substring(5, 7), 16);
        let b2 = parseInt(c2.substring(5, 7), 16);

	let r = Math.round((r1 + r2) / 2);
	let g = Math.round((g1 + g2) / 2);
	let b = Math.round((b1 + b2) / 2);
	return makeColor(r, g, b);
}

// Takes three integers from 0 to 255 as inputs; returns a formatted string representing the corresponding color
var makeColor = function(r, g, b) {
	r = Math.round(r).toString(16);
	g = Math.round(g).toString(16);
	b = Math.round(b).toString(16);

        if (r.length == 1) {r = '0' + r;}
        if (g.length == 1) {g = '0' + g;}
        if (b.length == 1) {b = '0' + b;}
        return ('#' + r + g + b);
}


