// POS page js.

try {
	erpnext.pos.PointOfSale = erpnext.pos.PointOfSale.extend({
		make_search: function () {
			// this._super();
			var me = this;
			this.serach_item = frappe.ui.form.make_control({
				df: {
					"fieldtype": "Data",
					"label": "Item",
					"fieldname": "pos_item",
					"placeholder": __("Search Item")
				},
				parent: this.wrapper.find(".search-item"),
				only_input: true,
			});

			this.serach_item.make_input();
			this.serach_item.$input.on("keypress", function (event) {
				if((me.serach_item.$input.val() != "") || (event.which == 13)){
					me.items = me.get_items();
					me.make_item_list();
				}
			});

			this.search_item_group = this.wrapper.find('.search-item-group');
			sorted_item_groups = this.get_sorted_item_groups()
			var dropdown_html = sorted_item_groups.map(function(item_group) {
				return "<li><a class='option' data-value='"+item_group+"'>"+item_group+"</a></li>";
			}).join("");

			this.search_item_group.find('.dropdown-menu').html(dropdown_html);

			this.search_item_group.on('click', '.dropdown-menu a', function() {
				me.selected_item_group = $(this).attr('data-value');
				me.search_item_group.find('.dropdown-text').text(me.selected_item_group);

				me.page_len = 20;
				me.items = me.get_items();
				me.make_item_list();
			})

			me.toggle_more_btn();

			this.wrapper.on("click", ".btn-more", function() {
				me.page_len += 20;
				me.items = me.get_items();
				me.make_item_list();
				me.toggle_more_btn();
			});

			this.page.wrapper.on("click", ".edit-customer-btn", function() {
				me.update_customer()
			})
		},

		make_customer: function () {
			var me = this;

			if(!this.party_field) {
				if(this.page.wrapper.find('.pos-bill-toolbar').length === 0) {
					$(frappe.render_template('customer_toolbar', {
						allow_delete: this.pos_profile_data["allow_delete"]
					})).insertAfter(this.page.$title_area.hide());
				}

				this.party_field = frappe.ui.form.make_control({
					df: {
						"fieldtype": "Data",
						"options": this.party,
						"label": this.party,
						"fieldname": this.party.toLowerCase(),
						"placeholder": __("Select or add new customer")
					},
					parent: this.page.wrapper.find(".party-area"),
					only_input: true,
				});

				this.party_field.make_input();
				setTimeout(this.set_focus.bind(this), 500);
				me.toggle_delete_button();
			}

			this.party_field.awesomeplete =
				new Awesomplete(this.party_field.$input.get(0), {
					minChars: 0,
					maxItems: 99,
					autoFirst: true,
					list: [],
					filter: function (item, input) {
						if (item.value.includes('is_action')) {
							return true;
						}

						input = input.toLowerCase();
						item = this.get_item(item.value);
						result = item ? item.searchtext.includes(input) : '';
						if(!result) {
							me.prepare_customer_mapper(input);
						} else {
							return result;
						}
					},
					item: function (item, input) {
						var d = this.get_item(item.value);
						var html = "<span>" + __(d.label || d.value) + "</span>";

						if(d.customer_name) {
							var addx = me.address[d.value];
							html += '<br><span class="text-muted ellipsis">' + __(d.customer_name) + '</span>';
							if (addx) {
								html += '<br><div class="text-muted ellipsis">' 
								html +=	addx.address_line1 ? __(addx.address_line1) + "<br>" : ""
								html +=	addx.address_line2 ? __(addx.address_line2) + "<br>" : ""
								html += addx.city ? __(addx.city) + "<br>" : "",
								html += addx.state ? __(addx.state) : ""
								+ '</div>';
							}
						}

						return $('<li></li>')
							.data('item.autocomplete', d)
							.html('<a><p>' + html + '</p></a>')
							.get(0);
					}
				});

			this.prepare_customer_mapper()
			this.autocomplete_customers();

			this.party_field.$input
				.on('input', function (e) {
					if(me.customers_mapper.length <= 1) {
						me.prepare_customer_mapper(e.target.value);
					}
					me.party_field.awesomeplete.list = me.customers_mapper;
				})
				.on('awesomplete-select', function (e) {
					var customer = me.party_field.awesomeplete
						.get_item(e.originalEvent.text.value);
					if (!customer) return;
					// create customer link
					if (customer.action) {
						customer.action.apply(me);
						return;
					}
					me.toggle_list_customer(false);
					me.toggle_edit_button(true);
					me.update_customer_data(customer);
					me.refresh();
					me.set_focus();
					me.frm.doc["offline_pos_name"] = null;
					me.frm.doc["address"] = null;
					if(me.pos_profile_data.jmi_show_customer_details == 1){
						me.fetch_and_render_customer_info(customer);
					}

					me.list_customers_btn.removeClass("view_customer");
				})
				.on('focus', function (e) {
					$(e.target).val('').trigger('input');
					me.toggle_edit_button(false);

					if(me.frm.doc.items.length) {
						me.toggle_list_customer(false)
						me.toggle_item_cart(true)
					} else {
						me.toggle_list_customer(true)
						me.toggle_item_cart(false)
					}
				})
				.on("awesomplete-selectcomplete", function (e) {
					var item = me.party_field.awesomeplete
						.get_item(e.originalEvent.text.value);
					// clear text input if item is action
					if (item.action) {
						$(this).val("");
					}
				});
		},

		fetch_and_render_customer_info: function(customer) {
			var me = this;
			frappe.call({
				method: "jmi_erpnext.api.jmi_get_customer_information",
				args:{
					"customer_name": customer.customer_name
				},
				callback: function(r){
					var address = me.address[customer.customer_name];
					me.frm.doc["address"] = address;

					
					
					$(".po-no").blur(function () {
						console.log("pono");
						// // if(event.which == 13){
						// 	me.frm.doc["purchase_order_no"] = $(".po_no").val();
						// 	console.log(me.frm.doc.purchase_order_no)
						// // }
					});

					var custm_id = r.message;

					 var customer_info = {
					 	"customer": customer, 
					 	"address": address,
						"cust_id" : custm_id
					 };
									
					var html = frappe.render_template("jmi_customer_info", {"customer_info": customer_info})

					var customer_info = $(".customer-info");
					console.log("customer info", customer_info);

					$(".customer-info").remove();
					me.page.wrapper.find(".pos").prepend(html);
				}
			})	
		},

		set_primary_action: function () {
			var me = this;
			this.page.set_primary_action(__("New Cart"), function () {
				me.make_new_cart()
				me.make_menu_list()
			}, "fa fa-plus")

			this.page.set_secondary_action(__("Print"), function () {
				var html = frappe.render(me.print_template_data, me.frm.doc)
				me.print_document(html)
			})
			this.page.add_menu_item(__("Email"), function () {
				me.email_prompt()
			})
		},

		// prepare_customer_mapper: function(key) {

		// 	var me = this;
		// 	var customer_data = '';

		// 	if (key) {
		// 		key = key.toLowerCase().trim();
		// 		var re = new RegExp('%', 'g');
		// 		var reg = new RegExp(key.replace(re, '\\w*\\s*[a-zA-Z0-9]*'));


		// 		customer_data =  $.grep(this.customers, function(data) {
		// 			contact = me.contacts[data.name];
		// 			address = me.address[data.name]; //New
		// 			// console.log("AL1: ", address["address_line1"], "Reg: ", reg.test(address["address_line1"]));
		// 			// console.log("AL2: ", address["address_line2"], "Reg: ", reg.test(address["address_line1"]));
		// 			// console.log("City: ", address["city"], "Reg: ", reg.test(address["city"]));
		// 			// console.log("State: ", address["state"], "Reg: ", reg.test(address["state"]));
					
		// 			if(reg.test(data.name.toLowerCase())
		// 				|| reg.test(data.customer_name.toLowerCase())
		// 				|| (contact && reg.test(contact["mobile_no"]))
		// 				|| (contact && reg.test(contact["phone"]))
		// 				|| (address && reg.test(address["address_line1"])) //New
		// 				|| (address && reg.test(address["address_line2"])) //New
		// 				|| (address && reg.test(address["city"])) //New
		// 				|| (address && reg.test(address["state"])) //New
		// 				|| (data.customer_group && reg.test(data.customer_group.toLowerCase()))) {
		// 					return data;
		// 			}
		// 		})
		// 	} else {
		// 		console.log("NOT FOUND", key);
		// 		customer_data = this.customers;
		// 	}

		// 	this.customers_mapper = [];

		// 	customer_data.forEach(function (c, index) {
		// 		if(index < 30) {
		// 			contact = me.contacts[c.name];
		// 			address = me.address[c.name]; //New

		// 			if(contact && !c['phone']) {
		// 				c["phone"] = contact["phone"];
		// 				c["email_id"] = contact["email_id"];
		// 				c["mobile_no"] = contact["mobile_no"];
		// 			}
					
		// 			if(address) {
		// 				c["address_line1"] = address["address_line1"];
		// 				c["address_line2"] = address["address_line2"];
		// 				c["city"] = address["city"];
		// 				c["state"] = address["state"];
		// 			}

		// 			me.customers_mapper.push({
		// 				label: c.name,
		// 				value: c.name,
		// 				customer_name: c.customer_name,
		// 				customer_group: c.customer_group,
		// 				territory: c.territory,
		// 				phone: contact ? contact["phone"] : '',
		// 				mobile_no: contact ? contact["mobile_no"] : '',
		// 				email_id: contact ? contact["email_id"] : '',
		// 				address_line1: address ? c.address_line1 : '', //New
		// 				address_line2: address ? c.address_line2 : '', //New
		// 				city: address ? c.city : '', //New
		// 				state: address ? c.state : '', //New
		// 				searchtext: ['customer_name', 'customer_group', 'name', 'value',
		// 					'label', 'email_id', 'phone', 'mobile_no', 'address_line1', 'address_line2', 'city', 'state'] //New
		// 					.map(key => c[key]).join(' ')
		// 					.toLowerCase()
		// 			});
		// 		} else {
		// 			return;
		// 		}
		// 	});

		// 	this.customers_mapper.push({
		// 		label: "<span class='text-primary link-option'>"
		// 		+ "<i class='fa fa-plus' style='margin-right: 5px;'></i> "
		// 		+ __("Create a new Customer")
		// 		+ "</span>",
		// 		value: 'is_action',
		// 		action: me.add_customer
		// 	});
		// },
	});
} catch (e){ //online POS
	class JMIPointOfSale extends erpnext.pos.PointOfSale {
		constructor(wrapper){
			super(wrapper);
			console.log("extends!");
		};
		make() {
			console.log("inside make");
			return frappe.run_serially([
				() => frappe.dom.freeze(),
				() => {
					this.prepare_dom();
					this.prepare_menu();
					this.set_form_action();
					this.set_online_status();
				},
				() => this.setup_company(),
				() => this.setup_pos_profile(),
				() => this.make_new_invoice(),
				() => {
					frappe.timeout(1);
					this.make_items();
					this.bind_events();
					frappe.dom.unfreeze();
				},
				() => this.page.set_title(__('Online Point of Sale'))
			]);
		};

		// set_form_action() {
		// 	console.log("Buttns");
		// 	// if(this.frm.doc.docstatus){
		// 		this.page.set_secondary_action(__("Print"), () => {
		// 			// if (this.pos_profile && this.pos_profile.print_format_for_online) {
		// 			// 	this.frm.meta.default_print_format = this.pos_profile.print_format_for_online;
		// 			// }
		// 			// this.frm.print_preview.printit(true);
		// 		});

		// 		this.page.set_primary_action(__("New"), () => {
		// 			// this.make_new_invoice();
		// 		});

		// 		this.page.add_menu_item(__("Email"), () => {
		// 			this.frm.email_doc();
		// 		});
		// 	// }	
		// };
	};

	erpnext.pos.PointOfSale = JMIPointOfSale;
}