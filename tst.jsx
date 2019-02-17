"use strict";

// Cytoscape variable: 
var cy = cytoscape({
	container: document.getElementById("cy"),	// Div where we'll put the Cytoscape visualization

	elements: [],		// Where we'll put our nodes and edges

	style: [		// Graph stylesheet 
		{ selector: 'node',
			style: {
				'background-color': '#666',
				'label': 'data(id)',
				'font-size': 5,
				'width': 3,
				'height': 3,
				'padding': '20%'
			}
		},
		{ selector: 'edge',
	      		style: {
	        		'width': 2,
	        		'line-color': '#ccc',
	        		'target-arrow-color': '#ccc',
	        		'target-arrow-shape': 'triangle'
	      		}
	    	}
	  ],
});

// setFile: Takes an file selection event and displays the graph
var setFile = (evt) => {
	let file = evt.target.files[0];
	csv_to_json(file).then((json) => {
		setElements(extractElements(json.data));	
	});
};


// Takes a CSV file and returns a *promise* containing converted JSON
// NOTE: the JSON is contaiend in response.data
var csv_to_json = (csv) => {
	// Using Papa for the CSV => JSON conversion	
	console.log(csv);	
	return new Promise(function(complete, error) {
		Papa.parse(csv, {
			header: true,
			complete, error
		});
	});
};

// Takes JSON extracted from CSV file; formats for Cytoscape
var extractElements = (json) => {
	let elements = [];
	for (let i = 0; i < json.length; i++){
		let src = json[i]["Bait Locus"];
		let dst = json[i]["Prey Locus"];

		if (src != '' ) {
			elements.push({	data: {id: src }});
		};
				
		if (dst != '' ) {
			elements.push({	data: {id: dst}});
		};

		if ((src != '') && (dst != '')){
			elements.push({ data: {
				id: src + "_" + dst,
				source: src,
				target: dst
			}});
		}
	}
	return elements;
};

// Sets the Cytoscape elements to the elements[] array
var setElements = (elements) => {
	cy.add(elements);
	var layout = cy.layout({
		name: 'cose',
	});
	layout.run();
	cy.fit();
}

document.getElementById('files').addEventListener('change', setFile, false);
