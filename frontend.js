"use strict";

let csv_url = 'http://frozen-sea-47108.herokuapp.com/';
let biogrid_url = 'https://frozen-sea-47108.herokuapp.com/interactome?id=TGA3';

$('#files').change((event) => {
	setFile(event);
});

$('#server_button').click(() => {
	$('#statusdiv').text('Retrieving data from server...');
	get_data(csv_url);
});

$('#biogrid_button').click(() => {
	$('#statusdiv').text('Retrieving data from Biogrid...');
	get_data(biogrid_url);
});

$('#clear_button').click(() => {
	cy.remove(cy.elements());
	$('#statusdiv').text('Cleared the network.');
});

var get_data = (url) => {
	$.ajax({
		url: url,
		method: 'GET',
		type: 'application/json',
		success: (response) => {
			$('#statusdiv').text('Data retrieved...');
			cy.add(response.elements);
			loadGraph();
		},
		xhrFields: {
				withCredentials: true
		},
		crossDomain: true
	});
};

// Cytoscape variable:
var cy = cytoscape({
	container: document.getElementById("cy"),	// Div where we'll put the Cytoscape visualization
	minZoom: 5e-1,
	maxZoom: 40,

	style: [		// Graph stylesheet
		{ selector: 'node',
			style: {
				'background-color': '#666',
				'label': function(ele) {
						return ele.data('name')? ele.data('name') : ele.data('id');
				},
				'font-size': 5,
				'width': function (ele) {
					return 2 + 2 * Math.log2(ele.degree(true));
				},
				'height': function (ele) {
					return 2 + 2 *  Math.log2(ele.degree(true));
				},
				'border-width': 0.4,
				'padding': 0,
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
	        		'width': 1,
	        		'line-color': '#bbb',
							'opacity': 0.9
	      		}
	    	}
	  ],
});

// setFile: Takes an file selection event and displays the graph
var setFile = (evt) => {
	console.log('working');
	$('#statusdiv').text('Loading file...');
	let file = evt.target.files[0];
	csv_to_json(file).then((json) => {
		setElementsLocal(json.data);
		loadGraph();
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
var setElementsLocal = (json) => {
	$('#statusdiv').text('Parsing JSON...');

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
		let bait = cy.getElementById(bait_locus);
		// Add prey protein node
		let prey = cy.getElementById(prey_locus);

		// Create the bait node if it's not a duplicate
		if (bait.length == 0) {
			bait = cy.add({
				group: 'nodes',
				data: {
					id: bait_locus,
					name: bait_locus,
				}
			});
		}

		// Create the prey node if it's not a duplicate
		if (prey.length == 0) {
      prey = cy.add({
        group: 'nodes',
        data: {
          id: prey_locus,
					name: prey_locus,
        }
      });
    }

		// If bait has a name, add one
		if (bait_name) {
			bait.addClass('named');
			bait.data('name', bait_name);
		}

		// If the node doesn't already have bait notes, add it
		if (bait_notes) {
			bait.data('bait_notes', bait_notes);
		}

		// If the node doesn't have prey_tair, add it
		if (prey_tair) {
			prey.data('prey_tair', prey_tair);
		}

		// If the node doesn't have prey_description, add it
		if (prey_description) {
			prey.data('prey_description', prey_description);
		}

		// Add edge; ignore duplicates
		let edge_id = bait_locus + '_' + prey_locus;
		if (cy.getElementById(edge_id).length == 0) {
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
			$('#status').text('duplicate entry: ' + edge_id);
		}
	}
};

var loadGraph = () => {
	colorClusters(cy.elements());

	// 'Cose': a particular built-in layout (for positioning nodes)
	var layout = cy.layout({
		name: 'cose',
		nodeDimensionsIncludeLabels: true,
		fit: true,
		padding: 50,
		nodeRepulsion: function( node ){ return 100000; },
		nodeOverlap: 4,
	});

	// Layout doesn't affect the graph until it's run
	$('#statusdiv').text('Applying layout...');
				layout.run();

	cy.endBatch();
	// Fits the screen to the entire collection of nodes

	$('#statusdiv').text('Graph ready!');
};

// Find Markov clusters and color them randomly
var colorClusters = (elements) => {
	$('#statusdiv').text('Identifying Markov clusters...');
	let clusters = elements.markovClustering();

	$('#statusdiv').text('Coloring graph...');
	for(let i = 0; i < clusters.length; i++) {
		let clusterColor = randomColor();
		let cluster = clusters[i];

		// Might as well remember the clusters by indices
		cluster.data('cluster', i);
		cluster.data('cluster_color', clusterColor);
	}

  cy.edges().style('line-fill', "linear-gradient");
	cy.edges().style('line-gradient-stop-colors', function(edge){
		return edge.source().data('cluster_color') + ' ' + edge.target().data('cluster_color');
	});

	cy.edges().style('line-gradient-stop-positions', '0% 100%');

};
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
	} else if (evt.originalEvent.altKey) {
		focused.altclick(node, clicks + 1);
	}
	else {
		focused.click(node, clicks + 1);
		catJson(node.data());
	}
});

// Concatonate json with the depth of one level
var catJson = (json) => {
	let cat = '';
	for (var key in json){
		cat += key + ': ' + json[key] + '<br />';
	}
	$('#nodeinfo').html(cat);
}

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
		if (this.elements.size() > 0){
			cy.animate({
				fit: {
					eles: this.elements
				},
				duration: 350
			});
		}

		this.elements.animate({
			style: {
				opacity: 0.9
			},
			duration: 350
		});

		this.elements.complement().animate({
			style: {
				opacity: 0.07
			},
			duration: 350
		});

	}

	select (elements) {
                this.elementStack[this.stackSize] = elements;
                this.stackSize++;
		this.viewSelected();
	}

	addElements(elements) {
		this.select(this.elements.union(elements));
	}

	subtractElements(elements) {
		// This includes nodes that we want to retain
		let subtracted = this.elements.difference(elements);
		// Filter elements by
		let retainedEdges = subtracted.filter((element) => {
			return element.isEdge();
		});

		retainedEdges.forEach((edge) => {
			subtracted = subtracted.union(edge.target());
			subtracted = subtracted.union(edge.source());
		});

		this.select(subtracted);
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

	// Number of nodes connected to this node that are in focus
	focusedDegree (node, newelements) {
		let edges = node.edges((edge) => {
			return newelements.contains(edge);
		});

		let size = edges.size();
	}

	click(elements, n) {
		this.select(this.getNeighborhood(elements, n));
	}

	shiftclick(elements, n) {
		elements = this.getNeighborhood(elements, n);
		this.addElements(elements);
	}

	altclick(elements, n) {
		this.subtractElements(this.getNeighborhood(elements, n));
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
