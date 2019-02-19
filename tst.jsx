"use strict";

// Cytoscape variable: 
var cy = cytoscape({
	container: document.getElementById("cy"),	// Div where we'll put the Cytoscape visualization
	minZoom: 1e-50,
	maxZoom: 1e50,
	selectionType: 'additive',

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
						return 'darkgreen';
					} else {
						return 'grey';
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
				'opacity': 0.8 
					
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
	
	// 'Cose': a particular built-in layout (for positioning nodes)
	var layout = cy.layout({ name: 'cose' }); 

	// Layout doesn't affect the graph until it's run
	console.log('Applying layout...');
        layout.run();

	// Fits the screen to the entire collection of nodes	
	cy.fit();

	colorClusters();

	cy.endBatch();
	console.log('Graph ready!');
};

var colorClusters = () => {
	console.log('Identifying Markov clusters...');
	let clusters = cy.elements().markovClustering();

	console.log('Coloring graph...');
	for(let i = 0; i < clusters.length; i++) {
		let clusterColor = randomColor(0.8);
		let cluster = clusters[i];
		cluster.data('cluster', i);
		cluster.data('cluster_color', clusterColor);
	}
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
	if (e.key == ' ') {
		viewWhole();	
	}
};

// Upon clicking a node, hide any edge or node that isn't connected
cy.on('click', 'node', function(evt){
	console.log(evt);
	let node = evt.target;
	let neighbors = node.neighborhood().union(node);
	if(evt.originalEvent.shiftKey){
		addFocus(neighbors);
	} else if (evt.originalEvent.metaKey){
	} else {
		focus(neighbors);
	}
});

var focused = cy.collection();

var setFocused = function(elements) {
	elements.style('opacity', 1); 
	cy.fit(elements);
}

var setUnfocused = function(elements) {
        elements.style('opacity', function (ele) {
                if (ele.isNode()) {
                        return (0.9 / 8); 
                }   
                return (0.8 / 8); 
        });
}

var focus = function(elements) {
	focused = elements;
	setUnfocused(elements.abscomp());
	setFocused(elements);
	let unfocus = function(evt) {
		if(!evt.target.id) {
			viewWhole();
			cy.removeListener('click', unfocus);
		}
	}
        cy.on('click', unfocus); 
};

var addFocus = function(elements) {
	focused = focused.union(elements);
	focus(focused);
}

var viewWhole = function() {
	focused = cy.collection();
        cy.elements().style('opacity', function (ele) {
                if (ele.isNode()) {
                        return (0.9); 
                }
                return (0.8); 
        });
	cy.fit();
}

var randomColor = function() {
	let r = (1<<8)*Math.random()|0;
	let g = (1<<8)*Math.random()|0;
	let b = (1<<8)*Math.random()|0;
	let ratio = 255 / Math.max(r, g, b);
	r *= ratio;
	g *= ratio;
	b *= ratio;
	return makeColor(r, g, b);
}

var averageColor = function(c1, c2) {
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

var makeColor = function(r, g, b) {
	r = Math.round(r).toString(16);
	g = Math.round(g).toString(16);
	b = Math.round(b).toString(16);

        if (r.length == 1) {r = '0' + r;}
        if (g.length == 1) {g = '0' + g;}
        if (b.length == 1) {b = '0' + b;}
        return ('#' + r + g + b);
}

var make
