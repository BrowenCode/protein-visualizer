"use strict";

// Cytoscape variable: 
var cy = cytoscape({
	container: document.getElementById("cy"),	// Div where we'll put the Cytoscape visualization

	elements: [],		// Where we'll put our nodes and edges

	style: [		// Graph stylesheet 
		{ selector: 'node',
			style: {
				'background-color': '#666',
				'label': 'data(name)',
				'font-size': 5,
				'width': function (ele) {
					return 2 + Math.pow(ele.degree(true), 7/12);
				},
				'height': function (ele) {
					return 2 + Math.pow(ele.degree(true), 7/12);
				},
				'border-width': 0.5,
				'padding': '20%',
				'background-color': function (ele) {
					if (ele.hasClass('named')) {
						return 'green';
					} else {
						return 'gray';
					}
				},
				'color': function (ele) {
					if (ele.hasClass('named')) {
						return 'darkgreen';
					} else {
						return 'black';
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
	        		'target-arrow-color': '#ccc',
	        		'target-arrow-shape': 'triangle',
				'opacity': 0.7 
					
	      		}
	    	}
	  ],
});

// setFile: Takes an file selection event and displays the graph
var setFile = (evt) => {
	let file = evt.target.files[0];
	csv_to_json(file).then((json) => {
		setElements(json.data);
	});
};


// Takes a CSV file and returns a *promise* containing converted JSON
// NOTE: the JSON is contaiend in response.data
var csv_to_json = (csv) => {
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
	
	// 'Cose': a particular built-in layout (for positioning nodes)
	var layout = cy.layout({ name: 'cose' }); 

	// Layout doesn't affect the graph until it's run
        layout.run();

	// Fits the screen to the entire collection of nodes	
	cy.fit();

	// Displays the graph
	cy.endBatch();
};

// Add event listener for file button
document.getElementById('files').addEventListener('change', setFile, false);

// Add event listener for the spacebar
window.addEventListener("keydown", keypress, false);

// If the spacebar is pressed, we re-center to the entire graph
function keypress(e) {
	if (e.key == ' ') {
		cy.fit();
	}
};

// Upon clicking a node, hide any edge or node that isn't connected
cy.on('click', 'node', function(evt){
	var node = evt.target;
	console.log(node.data());
	let neighbors = node.neighborhood();
	cy.elements().style('opacity', function (ele) {
		if (ele.isNode()) {
			return (0.9 / 6);
		} 
		return (0.8 / 6);
	});
	neighbors.style('opacity', 1);
	node.style('opacity', 0.9);
	
	cy.fit(neighbors);

	// Add a one-use click listener to exit the view
	cy.once('click', function(evt) {
		console.log(evt.target.id);

		// We still want to be able to apply the existing functionality to nodes
		if(!evt.target.id || !evt.target.isNode()) {
			cy.elements().style('opacity', function(ele) {
				if (ele.isNode()) {
					return 0.9
				} return 0.8;
			});
		}
	});
});
